export const FetchTodos = async () => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API}/getMyTodos`, {
            method: "GET",
            credentials: "include"
        });

        if(!res.ok){
            alert("Failed to fetch");
        }
            const data = await res.json();
            console.log(data);
    } catch(e) {
        alert(`Failed to connect ${e}`);
    }
};