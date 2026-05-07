export const generateCalendarDays = (year: number, month: number) => {
    //月の初日の曜日(0:日、1:月...)
    const firstDayOfMonth = new Date(year, month-1, 1).getDay();

    //月の末日
    const lastDate = new Date(year, month, 0).getDate() + 1;

    //月の初日より前の空白を埋める
    const days = Array(firstDayOfMonth).fill(null);

    for(let d=1; d < lastDate; d++) days.push(d);

    return days;
};

export const createEmptyEvents = (year: Number, month: Number) => {
    const eventMap: Record<string, any> = {};
    for(let i=1; i <= 31; i++){
        const dateKey = `${String(year)}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        eventMap[dateKey] = {
            date: dateKey,
            title: ""
        };
    }

    return eventMap;
};