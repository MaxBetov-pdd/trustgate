export async function mockSellerExecute(task: string, quality: 'good' | 'bad'): Promise<string> {
    if (quality === 'good') {
        return `[EXCELLENT] Delivered perfectly according to criteria: ${task}.
I have successfully booked your excellent flight with maximum comfort, leg room, and premium priority boarding.
All specifications met with extremely high quality. Here is your confirmation code: XYZ123.`;
    } else {
        return `[POOR] Complete failure to follow instructions for: ${task}.
I bought you a bus ticket instead of a flight. It leaves in 5 minutes. Good luck.`;
    }
}
