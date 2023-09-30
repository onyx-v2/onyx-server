import {NpcSpawn} from "../../../npc";
import {MinGangFamilyLevel, QuestBlip, QuestBlipColor, QuestNpcParameters, RobberyTaskCooldownMinutes} from "./config";
import {FamilyReputationType} from "../../../../../shared/family";
import {menu} from "../../../menu";
import {houses} from "../../../houses";
import {getRandomInt} from "../../../../../shared/arrays";
import {HouseEntity} from "../../../typeorm/entities/houses";
import {createCrackPoint} from "./cracking";
import {system} from "../../../system";
import {inventory} from "../../../inventory";
import {inventoryShared, ITEM_TYPE} from "../../../../../shared/inventory";

// Ебучий костыль: без setTimeout выкидывает ошибку при старте сервера внутри NpcSpawn.Recreate(),
// мол createPed of undefined. (system блять undefined у него, ага)
setTimeout(() => {
    const questNpc = new NpcSpawn(QuestNpcParameters.Position, QuestNpcParameters.Heading, QuestNpcParameters.Model,
        QuestNpcParameters.Name, handleInteractNpc);

    mp.blips.new(QuestBlip, QuestNpcParameters.Position, {
        color: QuestBlipColor,
        shortRange: true,
        name: 'Вор со стажем'
    })
}, 10000);

async function handleInteractNpc(player: PlayerMp) {
    if (!player.user) return;

    if (!player.user.fractionData?.mafia) {
        player.notify('Nicht verfügbar für dich', 'error')
        return;
    }

    openJobMenu(player);
}

function openJobMenu(player: PlayerMp) {
    const jobMenu = menu.new(player, 'Einbruch in ein Haus');

    jobMenu.newItem({
        name: 'Los gehts',
        onpress: () => startJob(player)
    });

    jobMenu.open();
}

function startJob(player: PlayerMp) {
    if (player.housesCrackerData) {
        player.notify('Du hast das letzte Haus noch nicht ausgeraubt', 'error');
        return;
    }

    const nextTaskTime = player.user.entity.robberyTask_nextAvailableTime;
    if (system.timestamp < nextTaskTime) {
        const canGetTaskInMinutes = Math.ceil((nextTaskTime - system.timestamp) / 60);
        player.notify(`Du kannst eine neue Aufgabe übernehmen in ${canGetTaskInMinutes} Minuten`, 'error');
        return;
    }

    if (!isPlayerHaveBag(player)) {
        player.notify('Du brauchst eine Tasche, um den Raub zu beginnen', 'error');
        return;
    }

    player.user.entity.robberyTask_nextAvailableTime = system.getTimeAfter({ minutes: RobberyTaskCooldownMinutes });
    player.user.save();

    const house = pickRandomHouse();
    player.housesCrackerData = {
        robbedPoints: 0,
        robbedItems: [],
        isRobberyNotified: false,
        isLeavingAreaCreated: false,
        house: house
    };

    createCrackPoint(player, house);

    player.user.setWaypoint(house.x, house.y, house.z);
    player.notify('Gehe zu dem auf der Karte markierten Haus', 'info');
}

function isPlayerHaveBag(player: PlayerMp): boolean {
    return player.user.allMyItems
        .some(item => inventoryShared.get(item.item_id).type === ITEM_TYPE.BAGS);
}

function pickRandomHouse(): HouseEntity {
    const availableHouses = [...houses.data.values()]
        .filter(h => h.forTp === 0);

    return availableHouses[getRandomInt(0, availableHouses.length - 1)];
}