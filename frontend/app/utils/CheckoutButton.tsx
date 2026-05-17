"use client";

import { useState, useEffect, useRef} from "react";

export default function CheckoutButton() {
    const [isVisible, setIsVisible] = useState(false);

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
            <button className={isVisible ? "login-button-y" : "login-button-n"}>Login</button>

            <div className={isVisible ? "bottom-buttons-y" : "bottom-buttons-n"}>
                <button onClick={()=> window.location.href="/account"}>会計</button>
                <button onClick={()=> window.location.href="/calendar"}>ホーム</button>
                <button onClick={()=> window.location.href="/management"}>管理画面</button>
            </div>
        </>
    );
};