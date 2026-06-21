// 通知取得
  export const GetNotification = async () => {
    try{
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getNotification`, {
        method: "GET",
        credentials: "include",
      });

      if(!res.ok){
        alert("response error")
        return;
      };

      const data = await res.json();

      return data;
    } catch (e) {
      alert(`Failed to get notification: ${e}`);
    };
  };