/*
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  config options here 
};

export default nextConfig;
*/

/** @type {import('next').NextConfig} */
const nextconfig = {
  output: 'export', // これを追加！
  // 他の設定があればそのまま残す
};

module.exports = nextconfig;