"use client";

import (
    "./account.css"
);

export default function account (){
    //2か月前までのlogを見せる。それ以前はもっと見るボタンで10件さらに見れるように

    return (
        <div className="container">
            <div className="recipt-upload">
                <ul>
                    <li>
                        <p className="event-name">アジャラ山</p>

                        <label className="upload-button">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="file-input-hidden"
                            />
                        </label>
                    </li>

                    <li>
                        <p className="event-name">バーベキュー</p>
                    </li>
                    <li>
                        <p className="event-name">青森観光</p>
                    </li>
                </ul>
            </div>


            <div className="balance-cards">
                <p>現在の部費残高:  ￥200,000</p>
            </div>

            <ul className="history-list">
                <li>
                    <span className="history-date">2026-05-01</span>
                    <span className="history-content">備品購入</span>
                    <span className="history-amount">-￥500</span>
                </li>
                <li>
                    <span className="history-date">2026-04-26</span>
                    <span className="history-content">備品購入</span>
                    <span className="history-amount">-￥700</span>
                </li>
                <li>
                    <span className="history-date">2026-05-01</span>
                    <span className="history-content">備品購入</span>
                    <span className="history-amount">-￥500</span>
                </li>
                <li>
                    <span className="history-date">2026-05-01</span>
                    <span className="history-content">備品購入</span>
                    <span className="history-amount">-￥500</span>
                </li>
                <li>
                    <span className="history-date">2026-05-01</span>
                    <span className="history-content">備品購入</span>
                    <span className="history-amount">-￥500</span>
                </li>
                <li>
                    <span className="history-date">2026-05-01</span>
                    <span className="history-content">備品購入</span>
                    <span className="history-amount">-￥500</span>
                </li>
            </ul>
        </div>
    )
};