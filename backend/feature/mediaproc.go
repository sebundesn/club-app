package feature

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// 画像・動画の変換は ffmpeg に任せる。
// ffmpeg は EXIF の向きを自動で直してくれるので、スマホの縦写真が横向きになる問題も避けられる。
const (
	photoMaxSide = 1600
	thumbMaxSide = 400
	videoMaxSec  = 60
	videoMaxSide = 720
)

// 変換は t4g.micro では重いので、同時に走らせるのは1本だけにする
var transcodeSlot = make(chan struct{}, 1)

func ffmpegBin() string {
	if p := os.Getenv("FFMPEG_PATH"); p != "" {
		return p
	}
	return "ffmpeg"
}

func ffprobeBin() string {
	if p := os.Getenv("FFPROBE_PATH"); p != "" {
		return p
	}
	return "ffprobe"
}

func runFFmpeg(ctx context.Context, args ...string) error {
	// nice で本体(Goのアプリ)より低い優先度にする
	cmd := exec.CommandContext(ctx, "nice", append([]string{"-n", "10", ffmpegBin()}, args...)...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg failed: %w: %s", err, tail(stderr.String(), 500))
	}
	return nil
}

func tail(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

// photoArgs は長辺を max に縮めたJPEGを作る引数。小さい画像は拡大しない。
func photoArgs(in, out string, max int) []string {
	scale := fmt.Sprintf("scale='min(%d,iw)':'min(%d,ih)':force_original_aspect_ratio=decrease", max, max)
	return []string{"-y", "-i", in, "-vf", scale, "-frames:v", "1", "-q:v", "4", out}
}

func videoArgs(in, out string) []string {
	scale := fmt.Sprintf("scale=-2:'min(%d,ih)'", videoMaxSide)
	return []string{
		"-y", "-i", in,
		"-t", strconv.Itoa(videoMaxSec + 1),
		"-vf", scale,
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
		"-c:a", "aac", "-b:a", "96k",
		"-movflags", "+faststart",
		out,
	}
}

func processPhoto(ctx context.Context, in, outMain, outThumb string) error {
	if err := runFFmpeg(ctx, photoArgs(in, outMain, photoMaxSide)...); err != nil {
		return err
	}
	return runFFmpeg(ctx, photoArgs(outMain, outThumb, thumbMaxSide)...)
}

func processVideo(ctx context.Context, in, outMain, outThumb string) error {
	if err := runFFmpeg(ctx, videoArgs(in, outMain)...); err != nil {
		return err
	}
	// 先頭付近の1コマをサムネイルにする
	return runFFmpeg(ctx, append([]string{"-ss", "0.5"}, photoArgs(outMain, outThumb, thumbMaxSide)...)...)
}

// probeVideoDuration は動画の長さ(秒)を返す。動画として読めなければエラー。
// 秒数の確認はクライアントの申告ではなく、サーバーが中身を見て行う。
func probeVideoDuration(ctx context.Context, path string) (float64, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, ffprobeBin(),
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=codec_type:format=duration",
		"-of", "default=noprint_wrappers=1:nokey=0",
		path,
	).Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe failed: %w", err)
	}
	return parseProbe(string(out))
}

// parseProbe は ffprobe の出力から動画の長さを取り出す。映像ストリームが無ければエラー。
func parseProbe(out string) (float64, error) {
	hasVideo := false
	duration := -1.0
	for _, line := range strings.Split(out, "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			continue
		}
		switch k {
		case "codec_type":
			if v == "video" {
				hasVideo = true
			}
		case "duration":
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				duration = f
			}
		}
	}
	if !hasVideo {
		return 0, fmt.Errorf("no video stream")
	}
	if duration < 0 {
		return 0, fmt.Errorf("duration unknown")
	}
	return duration, nil
}
