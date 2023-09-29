import {HouseEntity} from "../../../typeorm/entities/houses";
import {CustomEvent} from "../../../custom.event";
import {houses} from "../../../houses";
import {createRobberyCheckpoints} from "./robbering";
import {Family} from "../../family";
import {FamilyReputationType} from "../../../../../shared/family";
import {MinGovFamilyLevel, PicklockBrokeChance, PicklockItemId} from "./config";
import {system} from "../../../system";
import {inventory} from "../../../inventory";
import {setHouseRobbingNow} from "./index";
import { User } from '../../../user'
import {fractionCfg} from "../../../fractions/main";

export function createCrackPoint(player: PlayerMp, house: HouseEntity) {
    CustomEvent.triggerClient(player, 'jobs:houseCracking:createCrackpoint', new mp.Vector3(house.x, house.y, house.z));
}

CustomEvent.registerClient('jobs:houseCracking:enterCrackpoint', crackHouse);
async function crackHouse(player: PlayerMp) {
    if (!player.user || !player.housesCrackerData) {
        return;
    }

    const house = player.housesCrackerData.house;
    if (!house.opened) {
        if (inventory.getItemsCountById(player, PicklockItemId) < 1) {
            player.notify('Du hast nicht die nötigen Dietriche, um diese Tür aufzubrechen.', 'error');
            return;
        }

        if (!player.housesCrackerData.isRobberyNotified) {
            sendRobberyNotifications(player, house);
        }

        const isSuccess = await CustomEvent.callClient(player, 'jobs:houseCracking:startMinigame', house.name);

        if (!isSuccess) {
            inventory.deleteItemsById(player, PicklockItemId, 1);
            player.notify('Das Hacken ist fehlgeschlagen, du kannst es erneut versuchen', 'error');
            return;
        }

        if (tryBrokePlayerPicklock(player)) {
            player.notify('Du hast das Schloss erfolgreich geknackt, aber während du den Dietrich geholt hast, wurde das Schloss aufgebrochen');
        }
    }

    createRobberyCheckpoints(player, house);
    houses.enterHouse(player, house);
    CustomEvent.triggerClient(player, 'jobs:houseCracking:destroyCrackPoint');

    setHouseRobbingNow(player.dbid, house.id);
}

function sendRobberyNotifications(player: PlayerMp, house: HouseEntity) {
    mp.players.toArray().filter(u => u.user?.fractionData?.police).forEach(user => {
        user.notify('Wir haben einen Bericht über einen Hauseinbruch erhalten. Wir haben es auf der Karte', 'warning')
    })

    player.housesCrackerData.govRobberyBlip = system.createDynamicBlip('robbery_' + house.id, 1, 3,
        { x: house.x, y: house.y, z: house.z }, 'Hausfriedensbruch', {
            fraction: fractionCfg.policeFactions,
            shortRange: false
        });

    player.housesCrackerData.isRobberyNotified = true;
}

function tryBrokePlayerPicklock(player: PlayerMp) : boolean {
    if (Math.random() > PicklockBrokeChance) {
        return false;
    }

    inventory.deleteItemsById(player, PicklockItemId, 1);
    return true;
}