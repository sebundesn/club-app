"use client";

import { useState, useEffect} from "react";

export default function CheckoutButton() {
    const [isVisible, setIsVisible] = useState(false);

    let timer: NodeJS.Timeout;

    const handleScroll = () => {
        setIsVisible(false);
        clearTimeout(timer);

        timer = setTimeout(() => {
            setIsVisible(true)
        }, 200);
    };

    useEffect(()=> {

        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("scroll", handleScroll)
            clearTimeout(timer);
        }
    }, []);

    return(
        <>
            <button className={isVisible ? "login-button-y" : "login-button-n"}>Login</button>

            <div className={isVisible ? "bottom-buttons-y" : "bottom-buttons-n"}>
                <button onClick={()=> window.location.href="/account"}>会計</button>
            </div>
        </>
    );
};