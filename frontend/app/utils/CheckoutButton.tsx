"use client";

import React, { useState, useEffect, useRef} from "react";

export default function CheckoutButton() {
    const [isVisible, setIsVisible] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");

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

        if(name === "" || password === "") {
            alert("空欄があります。");
            return;
        };

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
                method: "POST",
                headers: {"Content-Type": "application/json", },
                body: JSON.stringify({name, password}),
                credentials: "include",
            })

            if(!res.ok) {
                const errorText = await res.text();
                alert(errorText || "failed to login")
                return;
            }

            alert("login success!")
            setIsModalOpen(false);

        } catch (error: any) {
            alert(error.message);
        }
    };

    useEffect(()=> {

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
             onClick={() => setIsModalOpen(true)}
            >
                Login
            </button>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Login</h3>
                        <form onSubmit={handleLoginSubmit}>
                            <div className="input-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="submit" className="submit-btn">OK</button>
                                <button type="button" className="cancel-btn" onClick={()=>setIsModalOpen(false)}>Cancel</button>
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