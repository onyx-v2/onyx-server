import {FRACTION_TASK_ITEMS} from "../../../shared/fraction.task";
import {NpcSpawn} from "../npc";
import {menu} from "../menu";

FRACTION_TASK_ITEMS.map(npc => {
    let currentList = new Map<number, number>()
    npc.tasks.map((q, i) => currentList.set(i, -1));
    new NpcSpawn(npc.pos, npc.heading, npc.model, npc.name, player => {
        const user = player.user;
        if(!user) return;
        if(npc.fraction && !npc.fraction.includes(user.fraction)) return player.notify(`Du hast keinen Zugang`, 'error');
        const m = menu.new(player, npc.name, 'Liste der Aufgaben');
        currentList.forEach((owner, id) => {
            if(owner === -1) return;
            const cfg = npc.tasks[id];
            if(!cfg) return;
            m.newItem({
                name: cfg.name,
                desc: cfg.desc,
                onpress: () => {
                    let owner = currentList.get(id);
                    if(owner === -1) return player.notify('Dieser Auftrag ist nicht mehr verfügbar', 'error')
                    if(owner !== 0) return player.notify('Dieses wurde bereits von jemand anderem genommen', 'error')
                    currentList.set(id, user.id);

                }
            })
        })
        m.open()
    })
})