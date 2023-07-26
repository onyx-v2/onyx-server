import nodemailer from 'nodemailer'

export class Mail {
    private static transporter = nodemailer.createTransport({
        host: "smtp.yandex.ru",
        port: 465,
        secure: true,
        auth: {
            user: 'tech@onyx-gta.ru',
            pass: "ipfpqgqsnkthbhmp"
        }
    });
    static sendMail(fromName: string, to: string, subject: string, text: string){
        this.transporter.sendMail({
            //from: `${fromName} <no-reply@onyx-gta.ru>`, // sender address
            from: 'tech@onyx-gta.ru', // sender address
            to, // list of receivers
            subject, // Subject line
            text: text, // plain text body
            //html: "<b>Hello world?</b>" // html body
        });
    }
}