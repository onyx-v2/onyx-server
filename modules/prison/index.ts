import {
    PRISON_ARREST_MONEY,
    PRISON_FREE_POSITION, PRISON_HOSPITAL_RESPAWN_POS,
    PRISON_MINUTES_FOR_RUN,
    PRISON_SPAWN_POSITIONS, PRISON_TASKS_CD, PRISONER_DRESS_FEMALE, PRISONER_DRESS_MALE, TASKS_TIME_DELETE
} from "../../../shared/prison/config";
import {tablet} from "../tablet";
import {CustomEvent} from "../custom.event";
import {IPrisonData} from "../../../shared/prison/IPrisonData";
import {User} from "../user";
import {UserEntity} from "../typeorm/entities/user";
import {addAdminStats} from "../admin.stats";
import {enterMenu} from "./interactions/enterMenu";
import {NpcSpawn} from "../npc";
import {system} from "../system";
import './kitchen';
import {inventory} from "../inventory";

class Prison {
    private hashes: Map<number, string> = new Map<number, string>();

    constructor() {
        this.createTaskPed();
    }

    private taskPedHandler = (player: PlayerMp) => {
        if (!player.user) return;
        if (!player.user.prison) return player.notify('Diese Zuweisungen sind nur für Gefangene', 'error');
        if (this.hashes.has(player.user.id)) return player.notify('Du hast die Aufgabe bereits angenommen', 'error');
        if (player.user.prison.taskTime && system.timestamp - player.user.prison.taskTime < PRISON_TASKS_CD)
            return player.notify('Aufgaben können alle 5 Minuten übernommen werden', 'error');

        const prisonData = {...player.user.prison};

        prisonData.taskTime = system.timestamp;

        player.user.prison = prisonData;

        const userHash = system.randomStr(8);

        this.hashes.set(player.user.id, userHash);

        CustomEvent.triggerClient(player, 'prison:tasks:start', userHash);
    }

    private createTaskPed() {
        setTimeout(() => {
            new NpcSpawn(
                new mp.Vector3(1692.62, 2471.01, 45.59),
                1,
                'cs_casey',
                'Задания',
                this.taskPedHandler
            )
        }, 5000)
    }

    public sync(player: PlayerMp) {
        if (!player || !player.user) return;
        player.user.cuffed = false;
        player.user.adminRestore();

        if (player.user.prison.byAdmin) inventory.removeAllWeapons(player);

        const randCoords = PRISON_SPAWN_POSITIONS[Math.floor(Math.random() * PRISON_SPAWN_POSITIONS.length)];
        player.user.setJobDress(player.user.male ? PRISONER_DRESS_MALE : PRISONER_DRESS_FEMALE);
        player.user.teleport(randCoords.x, randCoords.y, randCoords.z, 0, 0);
        CustomEvent.triggerClient(player, "prison:sync", player.user.prison);
    }

    public free(player: PlayerMp) {
        CustomEvent.triggerClient(player, 'prison:clear');
        player.user.prison = null;
        player.user.setJobDress(null);
        player.user.teleport(PRISON_FREE_POSITION.x, PRISON_FREE_POSITION.y, PRISON_FREE_POSITION.z, 0, 0);
        player.user.adminRestore();
        player.user.notify("Du hast deine Zeit abgesessen", "success");
    }

    public jail(player: PlayerMp, target: PlayerMp, time: number, reason: string) {
        if (!target || !target.user) return;

        if (target.user.prison) return player.notify("Der Spieler ist bereits im Gefängnis.", "error");
        if (!target.user.cuffed) return player.notify("Der Gefangene muss mit Handschellen gefesselt werden.", "error");
        if (!target.user.wanted_level) return player.notify("Der Gefangene passt in keines der Profile.", "error");
        if (!player.user.is_gos) return player.notify("Du musst in einer Regierungsbehörde arbeiten", "error");


        if (player.user.is_gos) {
            const whoFraction = player.user.fractionData;
            target.user.writeRpHistory(`[${whoFraction.name}] ${player.user.name} (${player.user.id}) Er wurde inhaftiert für ${time / 60} Minuten. Grund - ${reason}`);
        }

        player.user.addMoney(PRISON_ARREST_MONEY, true, 'Spieler Verhaftung ' + target.user.name);
        player.user.log('gosJob', `Er wurde inhaftiert für ${time / 60} Minuten. Grund - ${reason}`, target);

        target.user.wanted_level = 0;
        target.user.wanted_reason = "";

        tablet.gosSearchDataReload(target.user.id)
        target.user.prison = {
            time,
            reason,
            byAdmin: false,
            policeId: player.user.id
        };

        this.sync(target);
    }

    public async systemJail(entity: UserEntity, time: number, reason: string) {
        entity.prison = JSON.stringify({
            time: time * 60,
            reason,
            byAdmin: true
        });
    }

    public async jailAdmin(player: PlayerMp, targetId: number, time: number, reason: string) {
        if (!player.user) return;
        if (!player.user.admin_level) return player.notify("Du hast keinen Zugang", "error")

        let user = player.user;
        let target = User.get(targetId);
        let data: UserEntity;

        data = target && target.user ? target.user.entity : await User.getData(targetId)

        if (!mp.players.exists(player)) return;
        if (!data) return player.notify("Spieler mit der angegebenen ID wird nicht erkannt", "error")
        if (mp.players.exists(target) && target.user.isAdminNow()) return player.notify("Der Spieler nimmt die Aufgaben eines Verwalters wahr", "error");

        const prisonData: IPrisonData = data.prison ? JSON.parse(data.prison) : {
            time: time * 60,
            reason,
            byAdmin: true,
            adminName: `${player.user.name} #${player.user.id}`
        };

        if (prisonData.byAdmin && data.prison) prisonData.time += time * 60;


        if (target && target.user) {
            target.user.prison = prisonData;
            this.sync(target);
        } else {
            data.prison = JSON.stringify(prisonData);
            data.save();
        }

        user.log('AdminJob', `Gab das Gefängnis weg für ${time} min, Grund - ${reason}`, data.id);
        addAdminStats(user.id, 'jail')

        const targetName = data.rp_name;

        mp.players.toArray().filter(p => p && p.user && p.user.isAdminNow()).forEach(p => {
            p.outputChatBox(`!{#80A6FF}Administrator ${player.user.name} gepflanzt ${targetName}[${targetId}] zur Demarche am ${time} Minuten. Grund: ${reason}`);
        })
    }


    public async unjail(player: PlayerMp, targetId: number) {
        let target = User.get(targetId);

        if (!mp.players.exists(player)) return;
        if (!target || !target.user)
            return player.notify("Spieler nicht gefunden", "error");

        if (!target.user.prison)
            return player.notify("Der Spieler ist nicht im Gefängnis", "error");

        if (target.user.prison.byAdmin)
            return player.notify("Dieser Spieler wurde von einem Administrator gesperrt", "error");

        this.free(target);
    }

    public async unjailAdmin(player: PlayerMp, targetId: number) {
        let target = User.get(targetId);
        let data: UserEntity;

        data = target && target.user ? target.user.entity : await User.getData(targetId)

        if (!mp.players.exists(player)) return;
        if (!data) return player.notify("Spieler mit der angegebenen ID wird nicht erkannt", "error");

        if (target && target.user) {
            if (!target.user.prison)
                return player.notify("Der Spieler ist nicht im Gefängnis", "error");

            this.free(target);
        } else {
            if (!data.prison) return player.notify("Der Spieler ist nicht im Gefängnis", "error");
            data.prison = null;
            data.save();
        }
    }

    public playerDeath = (player: PlayerMp) => {
        if (!player || !player.user || !player.user.jailSyncHave) return;

        player.user.spawn(PRISON_HOSPITAL_RESPAWN_POS[Math.floor(Math.random() * PRISON_HOSPITAL_RESPAWN_POS.length)]);
        CustomEvent.triggerClient(player, "prison:hospital:start");
    }

    public removeTime = (player: PlayerMp, time: number) => {
        if (!player.user || !player.user.prison) return;


        CustomEvent.triggerClient(player, 'prison:sync:time', time);
    }

    public tasksFinish = (player: PlayerMp, count: number, hash: string) => {
        if (!player.user) return false;
        if (!prison.hashes.has(player.user.id) || prison.hashes.get(player.user.id) !== hash) return false;
        prison.hashes.delete(player.user.id);

        const time = count * TASKS_TIME_DELETE;

        prison.removeTime(player, time);

        return true;
    }

    public playerLeave = (player: PlayerMp) => {
        if (!player || !player.user) return;

        const id = player.user.id;

        if (this.hashes.has(id)) this.hashes.delete(id);
    }
}

export const prison = new Prison();

enterMenu();

CustomEvent.registerClient("prison:sync:time", (player: PlayerMp, time: number) => {
    if (!player.user) return;

    if (time <= 0) {
        prison.free(player);
    } else {
        const data = {...player.user.prison};

        data.time = time;

        player.user.prison = data;
    }
})

CustomEvent.registerClient("prison:runaway", (player: PlayerMp, prisonData: IPrisonData) => {
    const data = {...player.user.prison};

    data.time = prisonData.time + PRISON_MINUTES_FOR_RUN * 60;

    player.notify(`Du hast versucht, aus dem Gefängnis zu fliehen, und hast eine zusätzliche Haftstrafe in Höhe von ${PRISON_MINUTES_FOR_RUN} Minuten`);

    player.user.prison = data;

    prison.sync(player);
});

CustomEvent.registerClient('prison:tasks:finish', prison.tasksFinish);

mp.events.add("playerDeath", prison.playerDeath);
mp.events.add("playerQuit", prison.playerLeave);