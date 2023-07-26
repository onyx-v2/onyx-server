import Discord from 'discord.js';

const client = new Discord.Client();

function getCorrectOnline() {
    return { online: mp.players.toArray().length, maxplayers: mp.config.maxplayers }
}
if(mp.config.announce){
    const adminNotifyHook = new Discord.WebhookClient('681570762255237142', 'TU1rOAb3qv7DVkNvWezV9wnlyDzzAG4SO4lHwyEbawDhAlhbnQbVB37ALd_jSt1esTsq')
    const needOnline = 50;
    setInterval(() => {
        const players = mp.players.toArray().length;
        if(players < needOnline) return;
        const admins = mp.players.toArray().filter(q => q.user && !q.user.afk && q.user.admin_level > 0 && q.user.admin_level < 6).length
        if(admins == 0){
            adminNotifyHook.send(`@here Внимание! На сервере ${players} игроков, администраторов при этом нет на сервере. Просим зайти`)
        }
    }, 15 * 60000)
}

// client.on('ready', () => {
//     if(!mp.config.announce) return;
//     console.log(`Logged in as ${client.user?.tag}!`);
//
//     client.guilds.fetch('271313202623676416').then(guild => {
//         system.debug.success('Found guild')
//         let lastOnline = 0;
//         const setName = () => {
//             const data = getCorrectOnline();
//             if (data.online == lastOnline) return;
//             lastOnline = data.online;
//             guild.channels.resolve('700783823016951928').setName(`📜 Онлайн: 👥 ${data.online} / ${data.maxplayers}`);
//         }
//         setName();
//         setInterval(() => {
//             setName()
//         }, 5000)
//     })
//
//
// });
// if(mp.config.announce) client.login('NzAwNzg0OTEyMjY1MTE3NzE4.XqCzMQ.WSMr5wOgwHDPZmE_sVK6zL2q6Bs');