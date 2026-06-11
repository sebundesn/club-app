"use client";

import React, { useState, useEffect, useRef} from "react";
import { UserInfoStruct } from "./schema";
//import { FetchTodos } from "./todo";

export default function CheckoutButton() {
    const [isVisible, setIsVisible] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [realname, setRealname] = useState("");
    const [username, setUsername] = useState("");

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

    const handleLoginSubmitPassword = async (e: React.SubmitEvent<HTMLFormElement>) => {
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

            data.is_initial ? setIsInitialLogin(true): setIsInitialLogin(false);

            setPassword("");
            setIsModalOpen(false);

//            if (window.location.pathname === '/calendar') {
//               await FetchTodos();
//           }

        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleLoginSubmitFirst = async (e: React.SubmitEvent<HTMLFormElement>) => {

        if (username === "" || realname === "") {
            alert("本名とユーザ名を書いてください。");
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/firstLogin`, {
                method: "POST",
                credentials: "include",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    realname: realname,
                    username: username,
                }),
            });

            if(!res.ok) {
                alert("保存に失敗しました。");
                return;
            }

            setIsInitialLogin(false);
        } catch(e) {
            alert(`connection error: ${e}`)
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

    const handleLogout = async () => {
        if(!window.confirm("ログアウトしますか？")) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/logout`, {
                method: "GET",
                credentials: "include", 
            });

            if(!res.ok){
                alert("サーバーエラーです。");
                return;
            };

            setUserInfo({
                ID: null,
                userName: "",
                role: "",
                isLoggedIn: false,
            });

        } catch (e) {
            alert(`logout failed: ${e}`)
        }
    };

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
             className={isVisible ? (userInfo.isLoggedIn ? "login-name" : "login-icon") : "login-button-n"}
             onClick={userInfo.isLoggedIn ? handleLogout : () => setIsModalOpen(true)}
            >
                {userInfo.isLoggedIn ? `${userInfo.userName[0]}` : ""}
            </button>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Login</h3>
                        <form onSubmit={handleLoginSubmitPassword}>
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


            {isInitialLogin && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>初期設定</h3>
                        <form onSubmit={handleLoginSubmitFirst}>
                            <div className="input-group">
                                <label>本名</label>
                                <input
                                    type="name"
                                    value={realname}
                                    onChange={(e) => setRealname(e.target.value)}
                                    required
                                />
                                <p>*名字と名前の間はスペースを空けてください！</p>

                                <label>ユーザー名</label>
                                <input
                                    type="name"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="modal-action">
                                <button type="submit" className="submit-btn">OK</button>
                            </div>
                        </form>
                        
                    </div>
                </div>
            )}
        </>
    );
};