"use client";

import React, { useState, useEffect, useRef} from "react";
import { UserInfoStruct } from "./schema";
import { FetchTodos } from "./todo";

export default function CheckoutButton() {
    const [isVisible, setIsVisible] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [password, setPassword] = useState("");

    //a user information management state
    const [userInfo, setUserInfo] = useState<UserInfoStruct>({
        ID: null,
        userName: "",
        role: "",
        isLoggedIn: false,
    });

    //初期ログインかどうかの判定
    const [isInitialLogin, setIsInitialLogin] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const handleScroll = () => {
        setIsVisible(false);
        if (timerRef.current){
            clearTimeout(timerRef.current)
        }

        timerRef.current = setTimeout(() => {
            if (window.scrollY > 100){
                setIsVisible(true);
            };
        }, 300);
    };

    const handleLoginSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        if(password === "") {
            alert("空欄です。");
            return;
        };

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
                method: "POST",
                headers: {"Content-Type": "application/json", },
                body: JSON.stringify({password: password}),
                credentials: "include",
            })

            if(!res.ok) {
                const errorText = await res.text();
                alert(errorText || "failed to login")
                setPassword("");
                return;
            }

            const data = await res.json();
            setUserInfo({
                ...userInfo,
                ID: data.id, 
                userName: data.name,
                role: data.role,
                isLoggedIn: true, 
            });

            if(data.is_initial) {
                alert("名前(例： 山田 太郎)を記入してください。");
            }

            setPassword("");
            setIsModalOpen(false);

            if (window.location.pathname === '/calendar') {
                await FetchTodos();
            }

        } catch (error: any) {
            alert(error.message);
        }
    };

    const checkAuth = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/checkAuth`, {
                method: "GET",
                credentials: "include",
            });

            if(res.ok){
                const data = await res.json();
                if(data.logged_in){
                    setUserInfo({
                        ID: data.id,
                        userName: data.name,
                        role: data.role,
                        isLoggedIn: true,
                    })
                }
            }

        } catch (e) {
            alert(`Failed to connect: ${e}`);
        }
    };

    const handleLogout = () => {
        setUserInfo({
            ID: null,
            userName: "",
            role: "",
            isLoggedIn: false,
        });
    }

    useEffect(()=> {

        checkAuth();
        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            };
        }
    }, []);

    return(
        <>
            <button
             className={isVisible ? "login-button-y" : "login-button-n"}
             onClick={userInfo.isLoggedIn ? handleLogout : () => setIsModalOpen(true)}
            >
                {userInfo.isLoggedIn ? `${userInfo.userName}` : "Login"}
            </button>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Login</h3>
                        <form onSubmit={handleLoginSubmit}>
                            <div className="input-group">
                                <label>学籍番号</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={()=>setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="submit-btn">OK</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className={isVisible ? "bottom-buttons-y" : "bottom-buttons-n"}>
                <button onClick={()=> window.location.href="/account"}>会計</button>
                <button onClick={()=> window.location.href="/calendar"}>ホーム</button>
                <button onClick={()=> window.location.href="/management"}>管理画面</button>
            </div>
        </>
    );
};