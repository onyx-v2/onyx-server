import {CustomEvent} from "../custom.event";
import {menu} from "../menu";
import {system} from "../system";
import {
    GIVE_MONEY_PER_TASK,
    QUICK_HEAL_COST,
    VEHICLE_FINE_POLICE_MAX,
    VEHICLE_KEY_CREATE_COST
} from "../../../shared/economy";
import {SYNC_ANIM_LIST} from "../../../shared/anim";
import {Vehicle} from "../vehicles";
import {inventory} from "../inventory";
import {User} from "../user";
import {CRIME_ROBBERY_INTEREST, CRIME_ROBBERY_PROFIT_LIMIT, FACTION_ID} from "../../../shared/fractions";
import {taxi} from "../taxi";
import {business} from "../business";
import {houses} from "../houses";
import {
    CUFFS_ITEM_ID,
    CUFFS_KEY_ITEM_ID,
    getItemName,
    OWNER_TYPES,
    SCREWS_DESTROYER_ITEM_IDS,
    SCREWS_ITEM_ID
} from "../../../shared/inventory";
import {getDocumentData} from "../city.hall";
import {ANCHOR_LIST} from "../../../shared/vehicles";
import {canFight, getZoneAtPosition, getZoneConf, getZoneOwner, setZoneControl, startFight} from "../gangwar";
import {UdoData} from "../../../shared/licence";
import {nonHiddenMasksIds} from "../../../shared/masks";
import {
    ADV_JAIL_FREE_COST_MIN,
    ADV_JAIL_FREE_COST_MIN_MORE,
    ADV_JAIL_FREE_COST_MIN_MORE_TIME,
    ADV_MONEY_PERCENT_TO_USER
} from "../../../shared/jail";
import {MoneyChestClass} from "../money.chest";
import {GANGWAR_RADIUS} from "../../../shared/gangwar";
import {parking} from "../businesses/parking";
import {vehTaskData} from "../task";
import {FRACTION_LIST_TASKS_NPC} from "../../../shared/tasks";
import {gui} from "../gui";
import {
    FIRE_EXTINGUISHER_MIXTURE_ITEM_ID,
    FIRE_EXTINGUISHER_MIXTURE_PER_BALLOON,
    FIRETRUCK_FILL_MIXTURE_RANGE,
    FIRETRUCK_MAX_BALLOON_COUNT
} from "../jobs/firefighter/config";
import {isWaterSpotInRange} from "../jobs/firefighter/FireStation";
import {InterractionMenu} from "./InterractionMenu";
import {activeCars} from '../vehicle.grab'
import {sendExchangeRequest} from "../inventory.exchange";
import {Carry} from '../carry'
import {BATTLE_PASS_VEHICLES} from "../../../shared/battlePass/main";
import {BANNED_TAXI_MODELS} from "../../../shared/taxi";
import {fraction, fractionCfg} from "../fractions/main";
import {FRACTION_RIGHTS} from "../../../shared/fractions/ranks";

CustomEvent.registerClient('vehicle:interaction', (player, targetId: number) => {
    vehInteract(player, targetId);
});

const vehInteract = (player: PlayerMp, targetId: number) => {
    const user = player.user;
    if (!user) return;
    const target = mp.vehicles.at(targetId);
    if (!target) return;
    const check = () => {
        if (!mp.players.exists(player)) return false;
        if (!mp.vehicles.exists(target)) return false;
        if (system.distanceToPos(player.position, target.position) > 5) return false;
        if (player.dimension !== target.dimension) return false;
        return true;
    }

    const unlockVehGrab = () => {
        if(!check()) return;
        if(player.dimension) return player.notify('Du kannst hier keine Türen aufbrechen', 'error')
        if(player.vehicle) return player.notify('Du solltest nicht im Transportwesen sein', 'error');
        user.waitTimer(5,30, 'Türen aufbrechen', ["amb@medic@standing@tendtodead@idle_a", "idle_a"], target).then(status => {
            if (!status) return;
            if(!mp.players.exists(player)) return;
            if (!check()) return;
            if (!Vehicle.getLocked(target)) return;
            const itm = user.haveItem(813)
            if (!itm) return;
            if (system.getRandomInt(1, 7) === 3 || (target.entity && target.entity.data && target.entity.data.keyProtect)) itm.useCount(1, player), player.notify('Отмычка сломалась', 'error');
            if((target.entity && target.entity.data && target.entity.data.keyProtect) || (target.fraction && fractionCfg.getFraction(target.fraction).gos)){
                // dispatch.new(FACTION_ID.LSPD, `Сработала противоугонная защита на ${Vehicle.getName(target)} ${target.numberPlate}`, target.position, 30)
                return player.notify('Der Diebstahlschutz wurde ausgelöst', 'error')
                // if(system.getRandomInt(1, 100) < 85) {
                // }
            }
            Vehicle.setLocked(target, false);
            Vehicle.setEngine(target, true);
            player.notify('Замок вскрыт', "success");
            // Если вскрыл машину для Ламара
            if (activeCars.find(c => c.veh.id == target.id)) {
                mp.players.toArray().filter(u => u.user?.fractionData?.police).forEach(player => {
                    player.notifyWithPicture("Fahrzeugübergabe", 'Lamar', `Jemand brach in ein Auto ein ${target.modelname}, Kfz-Kennzeichen ${target.numberPlate}. Kartenkoordinaten`, 'DIA_LAMAR')
                    player.outputChatBox(`!{25B000} Jemand brach in ein Auto ein ${target.modelname}, Kfz-Kennzeichen ${target.numberPlate}. Kartenkoordinaten`)
                    CustomEvent.triggerClient(player, 'vehicleGrab:setBlipPos', target.position.x, target.position.y, target.position.z);
                })
                CustomEvent.triggerClient(player, 'vehicleGrab:deleteBlip')
            }
            player.user.achiev.achievTickByType("vehJack")
        })
    }
    
    if(target.isMission && target.missionOwner !== user.id) return player.notify('Du kannst nicht mit diesem TC interagieren', 'error');
    const interaction = new InterractionMenu(player, true);
    interaction.autoClose = true;
    
    if (target.fireSquad && player.user.fireSquad && target.fireSquad === player.user.fireSquad) {
        interaction.add('Mit Feuerlöschgemisch befüllen', '', 'star', () => {
            if (!isWaterSpotInRange(target.position, FIRETRUCK_FILL_MIXTURE_RANGE)) {
                player.notify('In der Nähe gibt es keine Stellen, an denen du dein Auto mit Löschmittel auftanken kannst. Sie befinden sich an Feuerwachen', 'error');
                return;
            }

            if (target.fireExtinguishingMixtureCount === FIRETRUCK_MAX_BALLOON_COUNT) {
                player.notify('Das Auto ist mit vollen Zylindern Feuerlöschgemisch gefüllt', 'error');
                return;
            }

            target.fireExtinguishingMixtureCount = FIRETRUCK_MAX_BALLOON_COUNT;
            player.notify(`Jetzt im Auto. ${FIRETRUCK_MAX_BALLOON_COUNT} volle Flaschen mit Feuerlöschgemisch`, 'success');
        });

        interaction.add('Hol die Feuerlöschermischung', '', 'star', async () => {
            if (target.fireExtinguishingMixtureCount === 0) {
                player.notify('Das Fahrzeug hat keine Feuerlöscherkanister mehr. Geh zurück zum Bahnhof, ' +
                    'um die Vorräte aufzufüllen', 'error');
                return;
            }

            const isPlayerAlreadyHasMixture =
                player.user.allMyItems.some(item => item.item_id === FIRE_EXTINGUISHER_MIXTURE_ITEM_ID)
                || await CustomEvent.callClient(player, 'firefighter:getMixtureInWeapon');
            if (isPlayerAlreadyHasMixture) {
                player.notify('Du hast deinen aktuellen Tank mit Gemisch noch nicht aufgebraucht');
                return;
            }

            target.fireExtinguishingMixtureCount--;
            await player.user.giveItem(FIRE_EXTINGUISHER_MIXTURE_ITEM_ID, true, true, FIRE_EXTINGUISHER_MIXTURE_PER_BALLOON);
        });
    }

    if(target.missionType == 'fractionVehicleDeliver'){
        const data = vehTaskData.get(user.id);
        if(!data || !data.count) return player.notify('Du kannst nicht mit diesem Fahrzeug interagieren', 'error');
        const cfg = FRACTION_LIST_TASKS_NPC[data.npc].tasks[data.task];
        if(!cfg) return player.notify('Du kannst nicht mit diesem Fahrzeug interagieren', 'error');
        if(cfg.returnPoint){
            if(!Vehicle.getLocked(target)) return player.notify('Bring das Fahrzeug zu dem auf der Karte markierten Ort', 'error');
            else interaction.add("Öffne die Türen", 'Kriminell', 'car', () => {
                const data = vehTaskData.get(user.id);
                if(!data || !data.count) return player.notify('Du kannst nicht mit diesem Fahrzeug interagieren', 'error');
                if(!user.haveItem(813)) return player.notify('Du hast keine Dietriche', 'error');
                unlockVehGrab()
            })
        } else {
            interaction.add("evakuieren", '', 'evacuation', () => {
                const data = vehTaskData.get(user.id);
                if(!data || !data.count) return player.notify('Du kannst nicht mit diesem Fahrzeug interagieren', 'error');
                Vehicle.destroy(target);
                data.count--;
                if(data.count > 0){
                    vehTaskData.set(user.id, data);
                } else {
                    FRACTION_LIST_TASKS_NPC[data.npc].tasks[data.task].positions.push(...data.points)
                    if(data.returnNeed) {
                        user.setWaypoint(data.returnNeed.x, data.returnNeed.y, data.returnNeed.z, 'Belohnung für Fahrzeugübergabe');
                        return player.notify('Jetzt musst du zurückgehen, um die Belohnung zu holen');
                    } else {
                        user.addMoney(data.reward, true, 'Belohnung für die Übergabe des Fahrzeugs bei der Arbeit');
                        vehTaskData.set(user.id, data);
                        const ids = user.id;

                        setTimeout(() => {
                            vehTaskData.delete(user.id);
                        }, data.cooldown * 60000)
                    }
                }
            })
        }

        return interaction.open();
    }





    if(target.entity && target.entity.owner === user.id){
        interaction.add("Schlüsselverwaltung", '', 'car', () => {
            const m = menu.new(player, 'Schlüsselverwaltung', 'Aktionen');
            m.onclose = () => {
                if (check()) return vehInteract(player, targetId);
            }

            m.newItem({
                name: "Schlüssel machen",
                more: `$${system.numberFormat(VEHICLE_KEY_CREATE_COST)}`,
                desc: 'Mit den Schlüsseln kann jeder, der sie besitzt, das Fahrzeug öffnen und schließen',
                onpress: () => {
                    player.user.tryPayment(VEHICLE_KEY_CREATE_COST, "card", () => {
                        return check()
                    }, `Zahlung für die Ausgabe von Nachschlüsseln für das Fahrzeug ${Vehicle.getName(target)} #${target.dbid}`, "Fahrzeugwartung").then(q => {
                        if(!q) return;
                        inventory.createItem({
                            owner_type: OWNER_TYPES.PLAYER,
                            owner_id: player.user.id,
                            item_id: houses.key_id,
                            advancedNumber: target.entity.key,
                            advancedString: "car",
                            serial: `ТС ${Vehicle.getName(target)} #${target.dbid}`,
                        })
                        player.notify("Du hast einen doppelten Schlüssel", "success")
                    })
                }
            })
            m.newItem({
                name: "Ändere das Schloss",
                desc: 'Wenn du das Schloss auswechselst, sind alle alten Schlüssel nicht mehr gültig',
                onpress: () => {
                    menu.accept(player).then(status => {
                        if (!status) return;
                        if (!check()) return;
                        target.entity.key = system.getRandomInt(1000000, 9999999);
                        target.entity.save();
                        player.notify('Das Schloss ist ersetzt worden', 'success');
                        m.close();
                    })
                }
            })

            m.open();
        })
    }

    if(user.is_police && target.dbid){
        interaction.add("Zum Parkhaus schicken", 'Fractional', 'evacuation', async () => {
            const sum = await menu.input(player, 'Gib den Betrag der Geldstrafe ein', '', 4, 'int');
            if (isNaN(sum) || typeof sum !== "number" || sum < 0 || sum > VEHICLE_FINE_POLICE_MAX) return player.notify(`Die Höhe des Bußgeldes ist nicht korrekt. Maximaler Bußgeldbetrag $${system.numberFormat(VEHICLE_FINE_POLICE_MAX)}`, 'error');
            const reason = await menu.input(player, 'Gib den Grund für das Bußgeld ein', '', 100);
            if(!reason) return player.notify('Grund nicht angegeben', "error");
            if (!check()) return;
            if (target.getOccupants().length != 0) return player.notify("Der TC muss leer sein", "error");
            target.entity.moveToParkingFine(sum, true, `${reason}. Eine Geldstrafe wurde verhängt ${user.name}[${user.dbid}]`);
            if(target.entity.owner) User.writeRpHistory(target.entity.owner, `ТС ${target.entity.name} ${target.numberPlate} wurde auf einen Abschlepphof geschickt $${system.numberFormat(sum)}`)
            user.log(user.isAdminNow(2) ? 'AdminJob' : 'gosJob', `ТС ${target.entity.name} ${target.numberPlate} wurde auf den Abschlepphof geschicktу $${system.numberFormat(sum)}`, target.entity.owner);
            player.notify('Das Fahrzeug wurde auf den Abschlepphof gebracht', 'success');
        })
    }
    if(target === player.vehicle && user.isDriver && Vehicle.haveDriftMode(target)){
        interaction.add("Drift mod setup", '', 'carTrunk', () => {
            if(!check()) return;
            CustomEvent.triggerCef(player, 'drift:setting', Vehicle.getDriftSettings(target))
        })
    }
    if (Vehicle.getLocked(target) && user.haveItem(813)){
        interaction.add("Öffne die Türen", 'Kriminell', 'car',() => {
            unlockVehGrab();
        })
    }

    if(user.taxiJob && user.taxiCar && user.taxiCar === target){
        interaction.add("Menü bestellen", '', 'receipt', () => {
            taxi.orderList(player);
        })
    }

    if (user.taxiJob && !user.taxiCar && Vehicle.hasAccessToVehicle(player, target) && target.entity && target.entity.owner) {
        interaction.add("Taxi", '', 'car', () => {
            if (!target.modelname) return player.notify('Dieses Fahrzeug kann nicht zum Rollen verwendet werden', 'error');

            if (BANNED_TAXI_MODELS.find(el => el === target.modelname))
                return player.notify('Dieses Fahrzeug kann nicht zum Rollen verwendet werden', 'error');

            user.taxiCar = target;
            CustomEvent.triggerClient(player, 'taxi:car', user.taxiCar.id)
            player.notify('Du hast erfolgreich ein privates Ruftaxiunternehmen gegründet!', 'success');
        })
    }

    if(target.getOccupants().length >= 1){
        interaction.add("Passagierliste", '', 'peoples', () => {
            if (!check()) return;
            if(target.getOccupants().length < 1) return;
            const m = menu.new(player, 'Passagiere', 'Список');
            target.getOccupants().map(pl => {
                if(pl.dbid === user.id) return;
                m.newItem({
                    name: `${user.getShowingNameString(pl)} #${pl.dbid}`,
                    onpress: () => {
                        m.close();
                        if (!check()) return;
                        playerInteract(player, pl.id)
                    }
                })
            })
            m.open()
        })
    }

    if (ANCHOR_LIST.find(q => q.toLowerCase() === target.modelname.toLowerCase())){
        interaction.add(Vehicle.getFreezeStatus(target) ? 'Den Anker entfernen' : 'Anker', '', 'car', () => {
            Vehicle.freeze(target, !Vehicle.getFreezeStatus(target))
        })
    }

    interaction.add("Inventar", '', 'fileTray', () => {
        let hasAccess = Vehicle.hasAccessToVehicle(player, target);

        if (Vehicle.getLocked(target) && !hasAccess) {
            player.notify("Kein Zugang", "error");
            vehInteract(player, targetId);
            return;
        }

        if (Vehicle.openTruckStatus(target)) inventory.openInventory(player);
        else return player.notify('Der Stiefel ist geschlossen', 'error'), vehInteract(player, targetId)
    })

    interaction.add(Vehicle.getLocked(target) ? 'Öffne die Türen' : 'Schließe die Türen', '', 'carHood', () => {
        Vehicle.lockVehStatusChange(player, target);
        vehInteract(player, targetId)
    })
    if (target.rentCar) {
        interaction.add('Beende den Mietvertrag', '', 'car', () => {
            if(target.rentCarOwner){
                const owner = User.get(target.rentCarOwner);
                if (!owner) return;
                if (owner.user.id !== player.user.id) return;
                owner.rentCar = null;
                Vehicle.destroy(target)
            }
        })
    }
    if (Vehicle.haveHood(target)){
        interaction.add(Vehicle.openHoodStatus(target) ? "Die Motorhaube schließen" : "Öffne die Motorhaube", '', 'carTrunk', () => {
            if (!check()) return;
            if (!user.canUseInventory) return;
            if (Vehicle.getLocked(target) && !Vehicle.openHoodStatus(target)) return player.notify("Fahrzeug geschlossen", "error"), vehInteract(player, targetId);
            Vehicle.setHoodStatus(target, !Vehicle.openHoodStatus(target));
            vehInteract(player, targetId);
        })
    }

    if(user.familyId != 0 && user.isFamilyLeader && target.entity && user.myVehicles.includes(target.entity)) {
        interaction.add('Übertrage deine Fahrzeug an eine Familie', 'Действия', 'car', () => {
            if (!check()) return;

            if (!user.family.canBuyMoreCar) return user.notify('Die Familie hat die Fahrzeug-Grenze erreicht')
            if (!target.entity || !user.myVehicles.includes(target.entity)) return;
            if (BATTLE_PASS_VEHICLES.find(el => target.entity.model === el) !== undefined)
                return player.notify('Du kannst keine Fahrzeuge aus einem Kampfpass übertragen');

            menu.accept(player, `Bestätige die Übergabe des Fahrzeugs ${target.entity.model} an deine Familie.`, 'small').then(status => {
                if (!status) return;
                if (!check()) return;
                if (!target.entity || !user.myVehicles.includes(target.entity)) return;
                if (user.familyId == 0 || !user.isFamilyLeader) return;
                if (!user.family.canBuyMoreCar) return user.notify('Die Familie hat die TK-Grenze erreicht')

                Vehicle.selectParkPlace(player, target.entity.avia, true).then(place => {
                    if (!place) return player.notify("Um das Fahrzeug zu bewegen, ist es notwendig, den Parkplatz anzugeben, auf dem das Fahrzeug abgestellt werden soll", "error");
                    if (!check()) return;
                    if (!target.entity || !user.myVehicles.includes(target.entity)) return;
                    const getParkPos = () => {
                        if (place.type === "house") return houses.getFreeVehicleSlot(place.id, target.entity.avia)
                        else return parking.getFreeSlot(place.id)
                    }
                    if (user.familyId == 0 || !user.isFamilyLeader) return;
                    if (!user.family.canBuyMoreCar) return player.notify('Es gibt nicht genug Plätze in der Familie für eine neue Fahrzeug')
                    target.entity.setOwnerFamily(user.family.entity, getParkPos())
                    user.notify(`Du hast dein Fahrzeug einer Familie gegeben`)
                })
            })
        })
    }


    const nearestPlayer = user.getNearestPlayer(2);
    if (user.isAdminNow(2) || user.is_police || (user.fraction === FACTION_ID.GOV && user.rank >= 3)){
        interaction.add("Evakuierung zu deinem eigenen Parkplatz", 'Aktionen', 'evacuation', async () => {
            if (!check()) return;
            if(target.getOccupants().length != 0) return player.notify('Es dürfen sich keine Passagiere im Fahrzeug befinden', 'error')
            target.getOccupants().map(q => {
                q.user.leaveVehicle();
            })
            setTimeout(() => {
                if (!check()) return;
                player.notify("Fahrzeug evakuiert")
                if (target.entity && target.entity.owner) user.log(user.isAdminNow(2) ? 'AdminJob' : 'gosJob', `Fahrzeug ${Vehicle.getName(target)} ${target.numberPlate} wurde evakuiert`, target.entity.owner);
                Vehicle.respawn(target)
            }, 500)
        })
    }
    const truckCfg = Vehicle.haveTruck(target)

    interaction.add(Vehicle.openTruckStatus(target) ? "Den Kofferraum schließen" : "Öffnen Sie den Kofferraum", '', 'carTrunk', () => {
        if (!check()) return;
        if (!user.canUseInventory) return;
        let hasAccess = Vehicle.hasAccessToVehicle(player, target);
        if (!hasAccess) return player.notify('Du hast nicht die Schlüssel zu diesem Fahrzeug', 'error'), vehInteract(player, targetId);

        Vehicle.setTruckStatus(target, !Vehicle.openTruckStatus(target))
        vehInteract(player, targetId)

        let vehicleInventoryBlock: [number, number];

        if (target.garagecarid) {
            vehicleInventoryBlock = [OWNER_TYPES.FRACTION_VEHICLE, target.garagecarid]
        }
        else if (!target.dbid) {
            vehicleInventoryBlock = [OWNER_TYPES.VEHICLE_TEMP, target.inventoryTmp]
        }
        else {
            vehicleInventoryBlock = [OWNER_TYPES.VEHICLE, target.dbid]
        }

        if (!vehicleInventoryBlock) {
            return;
        }

        inventory.reloadInventoryAdvanced(target.position, 10, target.dimension, false, vehicleInventoryBlock)
    })

    if (player.user && player.user.sanitationTrashBag && target.getVariable('sanitation')) {
        interaction.add('Stell den Müllsack ab', '', 'carTrunk', () => {
            if (!player.user.sanitationSquad)
                return player.notify('Du bist nicht in der Sitzung', 'error');

            if (player.user.sanitationSquad !== target.getVariable('sanitation'))
                return player.notify('Dieses Auto gehört nicht zu deiner Sitzung', 'error');

            player.user.sanitationTrashBag = false;

            target.trashBags += 1;

            CustomEvent.triggerClient(player, 'sanitation:deleteTrashBag');
        })
    }

    if (nearestPlayer && nearestPlayer.user && (nearestPlayer.user.cuffed || nearestPlayer.getVariable('inVehicleTruck'))){
        interaction.add(nearestPlayer.getVariable('inVehicleTruck') ? "Hol einen Mann aus dem Kofferraum" : "Einen Mann in den Kofferraum stecken", 'Aktionen', 'carTrunk',() => {
            if (!check()) return;
            if (!truckCfg) return;
            const nearestPlayer = user.getNearestPlayer(2);
            if (!mp.players.exists(nearestPlayer)) return;
            if (!nearestPlayer.user.cuffed && !nearestPlayer.getVariable('inVehicleTruck')) return;
            if (!Vehicle.openTruckStatus(target)) return player.notify("Öffne den Kofferraum", "error"), vehInteract(player, targetId);
            const pos = system.offsetPosition(target.position, target.rotation, new mp.Vector3(truckCfg.x, truckCfg.y, truckCfg.z));
            if (system.distanceToPos(player.position, pos) > 2) return player.notify("Du bist zu weit vom Stiefel entfernt", "error"), vehInteract(player, targetId);
            if (system.distanceToPos(nearestPlayer.position, pos) > 2) return player.notify("Das Ziel ist zu weit vom Stiefel entfernt", "error"), vehInteract(player, targetId);
            if(nearestPlayer.vehicle) return player.notify('Das Ziel ist im Transport', 'error');
            if (!nearestPlayer.getVariable('inVehicleTruck') && target.playerInTruck) return player.notify("Es ist bereits jemand im Kofferraum", "error"), vehInteract(player, targetId);
            if (nearestPlayer.getVariable('inVehicleTruck') && target.playerInTruck !== nearestPlayer.dbid) return player.notify("Du versuchst, einen Mann aus dem Kofferraum eines anderen Fahrzeugs zu ziehen.", "error"), vehInteract(player, targetId);
            target.playerInTruck = nearestPlayer.getVariable('inVehicleTruck') ? null : nearestPlayer.dbid
            nearestPlayer.setVariable('inVehicleTruck', nearestPlayer.getVariable('inVehicleTruck') ? null : target.id);
            vehInteract(player, targetId);
        })
    }
    if (!target.playerInTruck){
        interaction.add("In den Kofferraum klettern", 'Aktionen', 'carTrunk', () => {
            if (!check()) return;
            if (target.playerInTruck) return;
            if (Carry.isPlayerCarry(player) || Carry.isPlayerCarried(player)) return;
            if (!truckCfg) return;
            if (!Vehicle.openTruckStatus(target)) return player.notify("Öffne den Kofferraum", "error"), vehInteract(player, targetId);
            if(player.vehicle) return player.notify('Verlasse das Fahrzeug', 'error')
            const pos = system.offsetPosition(target.position, target.rotation, new mp.Vector3(truckCfg.x, truckCfg.y, truckCfg.z));
            if (system.distanceToPos(player.position, pos) > 2) return player.notify("Du bist zu weit vom Stiefel entfernt", "error"), vehInteract(player, targetId);
            if (target.playerInTruck) return player.notify("Es ist schon jemand im Kofferraum", "error"), vehInteract(player, targetId);
            target.playerInTruck = player.getVariable('inVehicleTruck') ? null : player.dbid
            player.setVariable('inVehicleTruck', player.getVariable('inVehicleTruck') ? null : target.id);
        })
    } else if (target.playerInTruck === player.dbid){
        interaction.add("Raus aus dem Kofferraum", 'Aktionen', 'carTrunk', () => {
            if (!truckCfg) return;
            if (!check()) return;
            if (!Vehicle.openTruckStatus(target) && user.canUseInventory) return player.notify("Der Kofferraum ist geschlossen und du kannst ihn nicht öffnen", "error"), vehInteract(player, targetId);
            target.playerInTruck = null
            player.setVariable('inVehicleTruck', null);
        })
    }

    interaction.open();
}

CustomEvent.registerClient('player:interaction', (player, targetId: number) => {
    playerInteract(player, targetId);
})

let healByItemTimer = new Map<number, boolean>();

const playerInteract = async (player: PlayerMp, targetId: number) => {
    const user = player.user;
    if (!user) return;
    if (targetId === player.id) return player.notify("Du kannst nicht mit dir selbst interagieren", "error");
    const target = mp.players.at(targetId);
    if (!mp.players.exists(target)) return;

    const check = () => {
        if (!mp.players.exists(player)) return false;
        if (!mp.players.exists(target)) return false;
        if (system.distanceToPos(player.position, target.position) > 5) return false;
        if (player.dimension !== target.dimension) return false;

        return true;
    }

    const interaction = new InterractionMenu(player)
    interaction.autoClose = true;

    if(user.is_police){
        interaction.add('Eine Geldstrafe verhängen', 'Фракционные', 'receipt',() => {
            if (!check()) return;
            menu.input(player, 'Gib den Betrag der Geldstrafe ein', '', 4, 'int').then(sum => {
                if (!check()) return;
                if(!sum || sum <= 0 || isNaN(sum)) return;
                if (sum > 10000) return player.notify(`Du kannst nicht mehr angeben als das ${system.numberFormat(10000)}`);
                menu.input(player, 'Gib den Grund ein', '', 30).then(reason => {
                    if (!check()) return;
                    if(!reason) return;
                    reason = system.filterInput(reason);
                    if(!reason) return;
                    player.notify('Anfrage gesendet');
                    menu.accept(target, `Du stimmst zu, die Strafe zu zahlen $${system.numberFormat(sum)}?`, 'small', 30000).then(status => {
                        if (!check()) return;
                        if (!status) return player.notify('Verweigerung', 'error');
                        if(!target.user.newFine(player, sum, reason)) {
                            player.notify(`Die Person ist nicht in der Lage, die Geldstrafe zu bezahlen`, 'error');
                            target.notify(`Du hast keine Möglichkeit, die Strafe zu bezahlen`, 'error');
                        } else {
                            player.notify(`Der Mann bezahlte die Strafe`, 'success');
                            const chest = MoneyChestClass.getByFraction(user.fraction);
                            if(chest) chest.addMoney(player, sum * 0.8, false)
                            user.addMoney(sum * 0.2, true, 'Verhängung einer Geldstrafe');
                        }
                    });
                })
            })
        });
    }

    if(user.fraction === 1 && user.tag && user.tag.toLowerCase().includes('адвокат') && target.user.jail_time){
        interaction.add('Entlassung aus dem Gefängnis', 'Fractional', 'thief',() => {
            if (!check()) return;
            const sum = Math.max(ADV_JAIL_FREE_COST_MIN, Math.floor((ADV_JAIL_FREE_COST_MIN_MORE_TIME > target.user.jail_time ? ADV_JAIL_FREE_COST_MIN : ADV_JAIL_FREE_COST_MIN_MORE) * (target.user.jail_time  / 60)))
            menu.accept(target, `Bist du damit einverstanden, gegen Bezahlung freigelassen zu werden? $${system.numberFormat(sum)}`).then(status => {
                if (!check()) return;
                if (!status) return player.notify('Verweigerung', 'error');
                if(!target.user.jail_time) return;
                if(target.user.money < sum) return player.notify('Du hast nicht genügend Geld, um zu bezahlen', 'error');
                target.user.removeMoney(sum, true, 'Zahlung von Anwaltskosten');
                const foradv = ((sum / 100) * ADV_MONEY_PERCENT_TO_USER)
                user.addMoney(foradv, true, 'Anwaltliche Dienstleistungen');
                const chest = MoneyChestClass.getByFraction(1);
                if(chest) chest.addMoney(player, sum - foradv, false);
                player.notify('Erbrachte Dienstleistungen', 'success')
                target.notify('Erbrachte Dienstleistungen', 'success')
                target.user.jail_time = 5;
                target.user.jail_reason = 'Befreiung';
                CustomEvent.triggerClient(target, 'jail:sync', 5, 'Befreiung', false)
            });
        });
    }

    if(user.is_gang && target.user.is_gang && user.rank >= 8 && target.user.rank >= 8 && user.fraction !== target.user.fraction){
        const zone = getZoneAtPosition(player.position);
        if(zone){
            const cfg = getZoneConf(zone);
            if(cfg && !cfg.spawn){
                const zoneowner = getZoneOwner(zone);
                if(zoneowner === target.user.fraction){
                    interaction.add('Dem betreffenden Gebiet den Krieg erklären', 'Fractional', 'swords',() => {
                        if (!check()) return;
                        if(system.distanceToPos2D({x: cfg.x, y: cfg.y}, player.position) > GANGWAR_RADIUS / 2) return player.notify('Versammle dich näher an der Mitte der Zone', 'error')
                        menu.accept(target, `Bist du mit einem Revierkampf einverstanden?`).then(status => {
                            if (!check()) return;
                            if (!status) return player.notify('Отказ', 'error');
                            if(!canFight(zone, user.fraction)) return player.notify('Du kannst jetzt nicht angreifen', 'error');
                            startFight(zone, user.fraction)
                        });
                    });
                } else if(zoneowner === user.fraction && user.isLeader && target.user.isLeader){
                    interaction.add('Übergib das Gebiet', 'Fractional', 'swords', () => {
                        if (!check()) return;
                        menu.accept(player, `Bist du sicher, dass`).then(status => {
                            if (!check()) return;
                            if (!status) return player.notify('Verweigerung', 'error');
                            if(!canFight(zone, user.fraction)) return player.notify('Es ist ein Kampf im Gange, du kannst kein Gebiet abgeben', 'error');
                            setZoneControl(zone, target.user.fraction)
                            player.notify('Das Gebiet wurde übertragen', 'success')
                            target.notify('Das Gebiet wurde übertragen', 'success')
                        });
                    });
                }
            }
        }
    }

    if (user.fraction === 16){
        if(target.user.health < 0.1){
            interaction.add('Epinephrin-Spritze', 'Behandlung', 'heart', () => {
                if (!check()) return;
                if(healByItemTimer.has(user.id)) return player.notify('Du hast kürzlich Epinephrin bekommen', 'error');
                if (target.user.health > 0) return player.notify('Der Patient braucht keine Wiederbelebung');
                const item = user.haveItem(910);
                if(!item) return player.notify('Du hast kein Epinephrin', 'error');
                gui.chat.sendDoCommand(player, `Erledigt${player.user.feemale ? 'а' : ''} eine intramuskuläre Injektion von Epinephrin und begann${player.user.feemale ? 'а' : ''} kardiopulmonale Wiederbelebung`)
                user.waitTimer(5,5, 'Wiederbelebung', ["missheistfbi3b_ig8_2", "cpr_loop_paramedic", true], target).then(status2 => {
                    if (!status2) return;
                    if (!check()) return;
                    if(healByItemTimer.has(user.id)) return player.notify('Du hast kürzlich Epinephrin bekommen', 'error');
                    if (target.user.health > 0) return player.notify('Der Patient braucht keine Wiederbelebung');
                    const item = user.haveItem(910);
                    if(!item) return player.notify('Du hast kein Epinephrin', 'error');
                    item.useCount(1, player);
                    let chance = system.getRandomInt(0, 100);
                    if(user.haveActiveLicense('reanimation')) chance = 100;
                    if(chance < 90) return player.notify('Wiederbelebung fehlgeschlagen', 'error');
                    target.user.health = 100;
                    player.notify('Du hast einen Mann wieder zum Leben erweckt', 'success')
                    target.notify('Du wurdest wiederbelebt', 'success');
                    CustomEvent.triggerClient(player, 'markDeath:destroy')// Удаляем маркер мертвого игрока если он есть
                    healByItemTimer.set(user.id, true);
                    const ids = user.id;
                    setTimeout(() => {
                        healByItemTimer.delete(ids);
                    }, 5 * 60000)
                })
            })
            interaction.add('Reanimieren', 'Behandlung', 'heart', () => {
                if (!check()) return;
                if (target.user.health > 0) return player.notify('Der Patient braucht keine Wiederbelebung');
                if (system.timestamp - target.user.lastReanimationTime <= 180) return player.notify('Der Patient wurde kürzlich wiederbelebt');
                const itm = user.haveItem(902);
                if (!itm) return player.notify('Du hast kein HLW-Set.', 'error');
                if (target.user.health > 0) return player.notify('Der Patient braucht keine Wiederbelebung');
                user.waitTimer(5,10, 'Wiederbelebung', ["missheistfbi3b_ig8_2", "cpr_loop_paramedic", true], target)
                    .then(status => {
                        if(!status) return;
                        if(!mp.players.exists(player)) return;
                        if (!check()) return;
                        if(target.user.health > 0) return player.notify('Der Patient braucht keine Wiederbelebung');
                        const itm = user.haveItem(902);
                        if (!itm) return player.notify('Du hast kein HLW-Set.', 'error');
                        user.addMoney(350, true, 'Wiederbelebung')
                        target.user.health = 100;
                        itm.useCount(1, player)
                        player.notify('Du hast einen Mann wieder zum Leben erweckt', 'success')
                        CustomEvent.triggerClient(player, 'markDeath:destroy')// Удаляем маркер мертвого игрока если он есть
                        target.notify('Du wurdest wiederbelebt', 'success');
                        target.user.lastReanimationTime = system.timestamp;
                    })
            })
        } else if(target.user.health < 100){
            interaction.add('Heilung', 'Behandlung', 'heart', () => {
                if (!check()) return;
                if (target.user.health === 100) return;
                const itm = user.haveItem(902);
                if (!itm) return player.notify('Du hast keinen Erste-Hilfe-Kasten zum Behandeln', 'error');
                menu.input(player, 'Gib den Betrag ein (0-700)', 100, 3, 'int').then(sum => {
                    if(typeof sum !== "number") return;
                    if(isNaN(sum)) return;
                    if(sum < 0 || sum > 700) return player.notify('Der Betrag ist nicht korrekt', 'error')
                    if (!check()) return;
                    if (target.user.health === 100) return;
                    menu.accept(target, `Geheilt in ${system.numberFormat(sum)}`).then(status => {
                        if(!status) return;
                        if (!check()) return;
                        if (target.user.health === 100) return;
                        const itm = user.haveItem(902);
                        if (!itm) return player.notify('Du hast keinen Erste-Hilfe-Kasten zum Behandeln', 'error');
                        if(sum > 0){
                            if(target.user.money < sum) return target.notify('Du hast nicht genügend Geld, um zu bezahlen', 'error')
                            target.user.removeMoney(sum, true, 'Bezahlung der Behandlung');
                            user.addMoney(sum, true, 'Behandlung')
                        }
                        target.user.health = 100;
                        itm.useCount(1, player)
                        player.notify('Du hast einen Mann geheilt', 'success')
                        target.notify('Du wurdest geheilt', 'success');
                    })
                })

            })
        }
        if (target.user.health > 0.1){
            const timer = await target.user.getHospitalTimer();
            if (!check()) return;
            if (timer > 0) {
                const sum = target.user.haveActiveLicense('med') ? QUICK_HEAL_COST.MANUAL_LICENSE : QUICK_HEAL_COST.MANUAL;
                interaction.add(`Schreib es auf $${sum}`, 'Behandlung', 'documentText', async () => {
                    if (!check()) return;
                    const timer = await target.user.getHospitalTimer();
                    if (timer <= 0) return;
                    if (!check()) return;
                    menu.accept(target, `Check out für $${sum}`).then(status => {
                        if(!status) return;
                        if (!check()) return;
                        if (target.user.money < sum) return target.notify('Du hast nicht genug Geld, um aus dem Krankenhaus entlassen zu werden', 'error');
                        target.user.removeMoney(sum, true, `Entlassung aus dem Krankenhaus ${target.user.name} #${target.user.id}`)
                        CustomEvent.triggerClient(target, 'hospital:clearHealTimer')
                        player.notify('Du hast einen Mann entlassen', 'success')
                        user.addMoney(sum * 0.3, true, 'Entlassung aus dem Krankenhaus');
                        const chest = MoneyChestClass.getByFraction(16);
                        if(chest) chest.addMoney(player, sum - (sum * 0.3), false);
                    })
                })
            }
        }
    } else if(target.user.health <= 0){
        interaction.add('Epinephrin-Spritze', 'Лечение', 'heart', () => {
            if (!check()) return;
            if(healByItemTimer.has(user.id)) return player.notify('Du hast kürzlich Epinephrin bekommen', 'error');
            if (target.user.health > 0) return player.notify('Der Patient braucht keine Wiederbelebung');
            const item = user.haveItem(910);
            if(!item) return player.notify('Du hast kein Epinephrin', 'error');
            gui.chat.sendDoCommand(player, `Erledigt${player.user.feemale ? '' : ''} eine intramuskuläre Injektion von Epinephrin und begann${player.user.feemale ? '' : ''} kardiopulmonale Wiederbelebung`)
            user.waitTimer(5,5, 'Wiederbelebung', ["missheistfbi3b_ig8_2", "cpr_loop_paramedic", true], target).then(status2 => {
                if (!status2) return;
                if (!check()) return;
                if(healByItemTimer.has(user.id)) return player.notify('Du hast kürzlich Epinephrin bekommen', 'error');
                if (target.user.health > 0) return player.notify('Der Patient braucht keine Wiederbelebung');
                const item = user.haveItem(910);
                if(!item) return player.notify('Du hast kein Epinephrin', 'error');
                item.useCount(1, player);
                let chance = system.getRandomInt(0, 100);
                if(user.haveActiveLicense('reanimation')) chance = 100;
                if(chance < 66) return player.notify('Wiederbelebung fehlgeschlagen', 'error');
                target.user.health = 100;
                player.notify('Du hast einen Mann wieder zum Leben erweckt', 'success')
                target.notify('Du wurdest wiederbelebt', 'success');
                healByItemTimer.set(user.id, true);
                const ids = user.id;
                setTimeout(() => {
                    healByItemTimer.delete(ids);
                }, 1 * 60000)
            })
        })
    }
    const nearestVehicle = user.getNearestVehicle(4);
    if(nearestVehicle){
        const truckCfg = Vehicle.haveTruck(nearestVehicle)
        if(truckCfg){
            if (target && target.user && (target.user.cuffed || target.getVariable('inVehicleTruck'))){
                interaction.add(target.getVariable('inVehicleTruck') ? "Hol einen Mann aus dem Kofferraum" : "Einen Mann in den Kofferraum stecken", 'Transport', 'carTrunk', () => {
                    if (!check()) return;
                    if (!target.user.cuffed && !target.getVariable('inVehicleTruck')) return;
                    if (!Vehicle.openTruckStatus(nearestVehicle)) return player.notify("Öffne den Kofferraum", "error"), vehInteract(player, targetId);
                    const pos = system.offsetPosition(nearestVehicle.position, nearestVehicle.rotation, new mp.Vector3(truckCfg.x, truckCfg.y, truckCfg.z));
                    if (system.distanceToPos(player.position, pos) > 2) return player.notify("Du bist zu weit vom Stiefel entfernt", "error"), vehInteract(player, targetId);
                    if (system.distanceToPos(target.position, pos) > 2) return player.notify("Das Ziel ist zu weit vom Stiefel entfernt", "error"), vehInteract(player, targetId);
                    if(target.vehicle) return player.notify('Das Ziel ist im Transport', 'error');
                    if (!target.getVariable('inVehicleTruck') && nearestVehicle.playerInTruck) return player.notify("Es ist bereits jemand im Kofferraum", "error"), vehInteract(player, targetId);
                    if (target.getVariable('inVehicleTruck') && nearestVehicle.playerInTruck !== target.dbid) return player.notify("Вdu versuchst, einen Mann aus dem Kofferraum eines anderen Fahrzeugs zu ziehen.", "error"), vehInteract(player, targetId);
                    nearestVehicle.playerInTruck = target.getVariable('inVehicleTruck') ? null : target.dbid
                    target.setVariable('inVehicleTruck', target.getVariable('inVehicleTruck') ? null : nearestVehicle.id);
                    vehInteract(player, targetId);
                })
            }
        }

    }

    if (user.fraction && user.fractionData.mafia && user.isLeader && target.user.fraction && target.user.fractionData.mafia && target.user.isLeader){
        const biz = business.data
            .filter(biz => biz.mafiaOwner === user.fraction)
            .find(biz => system.isPointInPoints(player.position, biz.positions, 10))
        if(biz){
            interaction.add("Übertragung der Kontrolle über das Unternehmen", 'Aktionen', 'peoples', () => {
                if (!check()) return;
                menu.accept(player).then(status => {
                    if(!status) return;
                    if (!check()) return;
                    biz.mafiaOwner = target.user.fraction;
                    biz.save().then(() => {
                        if (!check()) return;
                        player.notify('Das Geschäft ist übergeben worden', "success");
                        target.notify('Das Geschäft ist übergeben worden', "success");
                    })
                })
            })
        }
    }

    if(target.vehicle && target.user.cuffed){
        interaction.add("Hol ihn aus dem Fahrzeug heraus", 'Transport', 'carTrunk', () => {
            if (!check()) return;
            if (target.vehicle && target.user.cuffed) {
                target.user.leaveVehicle();
            }
        })
    }
    if(!target.vehicle && target.user.cuffed){
        interaction.add("Ziehe ihn zum nächsten Fahrzeug", 'Transport', 'carTrunk', () => {
            if (!check()) return;
            if (!target.vehicle &&  target.user.cuffed) {
                const veh = User.getNearestVehicle(player, 3);
                if(!veh) return player.notify('TC nicht in der Nähe entdeckt', 'error')
                if (veh.getOccupant(2) && veh.getOccupant(3)) return player.notify('Es gibt keinen Platz in der TC', 'error');
                if (veh.getOccupant(2)) target.user.putIntoVehicle(veh, 3)
                else target.user.putIntoVehicle(veh, 2);
            }
        })
    }

    if(player.vehicle && user.isDriver && player.vehicle === target.vehicle){
        interaction.add("Raus aus der CU", 'Transport', 'carTrunk', () => {
            if (!check()) return;
            if(player.vehicle && user.isDriver && player.vehicle === target.vehicle){
                if(player.vehicle.taxiCar){
                    if(player.dbid === player.vehicle.taxiCar){
                        const order = taxi.list.find(q => q.driver === player.dbid && target.dbid === q.user);
                        if(order){
                            const dist = system.distanceToPos2D(player.position, order.end);
                            if(dist > 20) return player.notify('Du kannst keinen Passagier absetzen, bevor du an deinem Ziel angekommen bist', 'error');
                        }
                    }
                }
                target.user.leaveVehicle();
                target.notify('Der Fahrer hat dich aus dem Fahrzeug geworfen', 'error');
            }
        })
    }


    const items = user.allMyItems;
    const itcard = items.find(q => q.item_id === 800 && user.id + "_" + user.social_number === q.serial);
    if (itcard){
        interaction.add("Ausweis vorlegen", 'Papiere', 'documentText', async () => {
            if (!check()) return;
            if (!(await menu.accept(target, "Möchtest du die Dokumente lesen", null, 15000))) return player.notify('Игрок отказался');
            if (!check()) return;
            let data = await getDocumentData(itcard)
            if (!data) return player.notify("Ungültige Dokumente", "error")
            CustomEvent.triggerCef(target, "cef:idcard:new", data)
        })
    }
    if(UdoData.find(q => q.id === user.fraction)){
        const doc = user.haveItem(824);
        if(doc){
            interaction.add("Zeige " + getItemName(doc), 'Papiere', 'documentText', async () => {
                if (!check()) return;
                if (!(await menu.accept(target, "Möchten Sie die Dokumente sehen", null, 15000))) return player.notify('Игрок отказался');
                if (!check()) return;
                CustomEvent.triggerCef(target, "udo:show", user.udoData)
            })
        }
    }
    items.filter(q => q.item_id === 802).map(item => {
        interaction.add("Zeige " + getItemName(item), 'Papiere', 'documentText',async () => {
            if (!check()) return;
            if (!(await menu.accept(target, "Möchtest du die Dokumente lesen", null, 15000))) return player.notify('Игрок отказался');
            if (!check()) return;
            const [document, date, code, id, name, social, idCreator, nameCreator, socialCreator, real] = item.serial.split('|')
            CustomEvent.triggerCef(target, "document:show", document, date, code, id, name, social, idCreator, nameCreator, socialCreator, real)
        })
    })
    items.filter(q => q.item_id === 803).map(item => {
        interaction.add("Zeige " + getItemName(item), 'Papiere', 'documentText',async () => {
            if (!check()) return;
            if (!(await menu.accept(target, "Möchtest du die Dokumente lesen", null, 15000))) return player.notify('Игрок отказался');
            if (!check()) return;
            const [type, serial, code, timestring, userid] = item.serial.split('-')
            const time = parseInt(timestring);
            const userdata = await User.getData(parseInt(userid));
            if (!userdata) return player.notify("Der Besitzer der Dokumente hat das Land verlassen"), inventory.deleteItem(item);
            CustomEvent.triggerCef(target, "license:show", {
                type, serial: parseInt(serial), time, player: userdata.rp_name, code
            })
        })
    })

    interaction.add("Übergib das Geld", '', 'cash', () => {
        if (!check()) return;
        menu.input(player, `Gib den Betrag ein ($1 - $${system.numberFormat(system.smallestNumber(GIVE_MONEY_PER_TASK, user.money))})`, "", GIVE_MONEY_PER_TASK.toString().length, 'int').then(sum => {
            if (!sum) return;
            if (!check()) return;
            if (isNaN(sum)) return player.notify("Der Betrag ist nicht korrekt", "error");
            if (sum <= 0) return player.notify("Der Betrag ist nicht korrekt", "error");
            if (sum > 9999999) return player.notify("Der Betrag ist nicht korrekt", "error");
            if (sum > GIVE_MONEY_PER_TASK) return player.notify(`Der angegebene Betrag überschreitet das Limit $${system.numberFormat(GIVE_MONEY_PER_TASK)}`, "error");
            if (sum > player.user.money) return player.notify(`Du hast nicht genug Geld zum Übergeben $${system.numberFormat(sum)}`, "error");

            menu.accept(target, `Вы хотите взять $${system.numberFormat(sum)}?`, 'small').then(status => {
                if(!status) return;
                if (!check()) return;
                user.giveMoneyToPlayer(target, sum)
            })
        })
    })

    interaction.add("Angebot zum Umtausch", '', 'exchange', () => sendExchangeRequest(player, target));

    if (target.user.cuffed) {
        let uncuffText: string = null;

        if (target.user.policeCuffed && user.getItemsByIds([CUFFS_KEY_ITEM_ID])) {
            uncuffText = 'Entferne die Handschellen';
        } else if (!target.user.policeCuffed && user.getItemsByIds(SCREWS_DESTROYER_ITEM_IDS)) {
            uncuffText = 'Trenne die Bande'
        }

        if (uncuffText) {
            interaction.add(uncuffText, 'Fractional', 'handcuffs', () => {
                if (!check()) return;
                user.setUncuffedTarget(target);
            })
        }
    } else if (!target.user.cuffed){
        let cuffText: string = null;

        if (user.getItemsByIds([CUFFS_ITEM_ID]) && (user.is_police || user.is_government)) {
            cuffText = 'Handschellen anlegen';
        } else if (user.getItemsByIds([SCREWS_ITEM_ID])) {
            cuffText = 'Binde sie mit Kabelbindern zusammen'
        }

        if (cuffText) {
            interaction.add(cuffText, 'Fractional', 'handcuffs',() => {
                if (!check()) return;
                user.setCuffedTarget(target);
            })
        }
    }

    if (user.is_police) {
        const inMask = !nonHiddenMasksIds.includes(target.getClothes(1).drawable)
        if (inMask) interaction.add("Die Maske entfernen", 'Fractional', 'mask',() => {
            if (!check()) return;
            if(target.user.getJobDress && target.user.getJobDress.find(q => q[0] === 1)){
                const d = [...target.user.getJobDress]
                if(d.findIndex(q => q[0] === 1) > -1)d.splice(d.findIndex(q => q[0] === 1), 1);
                target.user.setJobDress(d);
            } else target.user.setDressValueById(950, 0);
            player.notify('Maske abgenommen')
            target.notify('Deine Maske ist heruntergerissen worden')
        })
    }

    if (user.is_gang || user.is_mafia) {
        // Если накинуты стяжки краймом
        if (target.user.cuffed && !target.user.policeCuffed) {
            interaction.add('Rob', 'Fractional', 'thief', () => {
                if (!check()) return;

                if (target.user.dead) {
                    return player.notify('Du kannst einen toten Spieler nicht ausrauben', 'error');
                }

                if (!target.user.canBeRobbed)
                    return player.notify('Man kann einen Spieler nicht oft genug berauben', 'error');

                if (user.family && target.user.family && user.familyId == target.user.familyId)
                    return player.notify('Du kannst ein Familienmitglied nicht ausrauben', 'error');

                let totalRobbed = Math.floor(target.user.money * CRIME_ROBBERY_INTEREST / 100);
                if (totalRobbed > CRIME_ROBBERY_PROFIT_LIMIT) totalRobbed = CRIME_ROBBERY_PROFIT_LIMIT;

                target.user.removeMoney(totalRobbed, false, `Von einem Spieler ausgeraubt ${player.user.dbid} auf ${system.numberFormat(totalRobbed)}`);
                player.user.addMoney(totalRobbed, false, `Er hat einen Spieler ausgeraubt ${target.user.dbid} auf ${system.numberFormat(totalRobbed)}`);

                user.playAnimation([['oddjobs@shop_robbery@rob_till', 'loop']], true, false);

                target.notify(`Du wurdest ausgeraubt bei ${system.numberFormat(totalRobbed)}`);
                target.user.lastRobbedTime = system.getTimeStamp();
            })
        }
    }
    if(user.haveItem(869)){
        interaction.add("Blumen schenken", 'Soziales', 'flowers', () => {
            if (!check()) return;
            menu.accept(target, `Soll ich die Blumen annehmen?`, 'small').then(status => {
                if (!check()) return;
                if(!status) return player.notify('Einladung abgelehnt', 'error');
                const item = user.haveItem(869);
                if(!item) return;
                player.user.removeAttachment('item_869');
                inventory.updateItemOwner(item.id, OWNER_TYPES.PLAYER, target.dbid, OWNER_TYPES.PLAYER, player.dbid)
                target.user.addAttachment('item_869');
                user.playSyncAnimation(target, ['mp_common', 'givetake2_a'], ['mp_common', 'givetake1_a']);
            })
        })
    }

    if (target.user.cuffed) {
        if(user.haveItem(813)){
            interaction.add("Öffnen der Handschellen mit Dietrichen", '', 'handcuffs', () => {
                if (!check()) return;
                if(!target.user.cuffed) return;
                user.waitTimer(3, 15, 'Öffnen der Handschellen', ['mp_arresting', 'a_uncuff'], target).then(status => {
                    if(!status) return;
                    if(!mp.players.exists(player)) return;
                    if (!check()) return;
                    if(!target.user.cuffed) return;
                    if(target.user.cuffed && target.user.policeCuffed && !user.is_police && target.user.getNearestPlayers(50).find(q => q && q.user && q.user.is_police && q.health > 0)) return player.notify('Вы не можете снять наручники, пока рядом находится сотрудник гос структур', 'error')
                    const item = user.haveItem(813);
                    if(!item) return;
                    item.useCount(1, player)
                    target.user.cuffed = false;
                    player.notify('Die Handschellen sind ab', 'success')
                    target.notify('Die Handschellen sind ab', 'success')
                })
            })
        }
        interaction.add(!target.user.follow ? "Den Weg weisen" : "Aufhören zu führen", 'Fractional', 'handshake',() => {
            if (!check()) return;
            user.setFollowTarget(target)
        })
    }

    if(user.family && !target.user.familyId && user.familyId !== target.user.familyId && user.family.isCan(user.familyRank, 'invite')){
        interaction.add("In die Familie einladen", 'Familie', 'peoples', async () => {
            if (!check()) return;
            if(user.family.maximumMembersCount <= await user.family.getMembersCount()) return player.notify('Deine Familie hat ihr Teilnehmerlimit erreicht');
            if (target.user.familyId) return player.notify("Du kannst niemanden einladen, der bereits in einer Familie ist.", 'error');

            player.notify('Die Einladung wurde verschickt', 'success');
            menu.accept(target, `Du willst dich der Familie anschließen ${user.family.name}?`, 'small').then(status => {
                if (!check()) return;
                if(!status) return player.notify('Einladung abgelehnt', 'error');
                target.user.family = user.family;
                user.log('familyInvite', `принял в семью ${user.family.name}`, target)
                player.notify('Einladung angenommen', 'success');
                target.notify('Einladung angenommen', 'success');
            })
        })
    }

    if (user.fraction && user.fraction !== target.user.fraction){
        if(fraction.getRightsForRank(user.fraction, user.rank).includes(FRACTION_RIGHTS.INVITE)){
            interaction.add("Zur Organisation einladen", 'Fractional', 'businessSharp',() => {
                if (!check()) return;
                if (target.user.fraction) return player.notify("Du kannst niemanden aufnehmen, der bereits ein Mitglied der Organisation ist", 'error');
                if (target.user.haveActiveWarns){
                    player.notify('Es ist unmöglich, diese Person einzuladen', 'error')
                    target.notify('Wenn du einen aktive Warn hast, kannst du nicht eingeladen werden.', 'error')
                    return;
                }
                player.notify('Die Einladung wurde verschickt', 'success');
                menu.accept(target, `Du möchtest einer Organisation beitreten ${fractionCfg.getFractionName(user.fraction)}?`, 'small').then(status => {
                    if (!check()) return;
                    if(!status) return player.notify('Einladung abgelehnt', 'error');
                    target.user.fraction = user.fraction;
                    user.log('fractionInvite', `in die Organisation aufgenommen ${fractionCfg.getFractionName(user.fraction)}`, target)
                    player.notify('Einladung angenommen', 'success');
                    target.notify('Einladung angenommen', 'success');
                })
            })
        }
    }

    if (user.gr6job && user.gr6jobLeader && target.user.gr6job && !target.user.gr6jobId){
        interaction.add("Zum Kader hinzufügen GR6", '', 'peoples', () => {
            if (!check()) return;
            menu.accept(target, `Würdest du gerne dem GR6 beitreten?`, 'small').then(status => {
                if (!status) return;
                if (!check()) return;
                if (user.gr6job && user.gr6jobLeader && target.user.gr6job && !target.user.gr6jobId){
                    target.user.gr6jobId = user.gr6jobId
                    target.user.gr6jobLeader = false;
                    player.notify("Ein Neuzugang im Kader");
                    target.notify("Du hast dich erfolgreich in die Gruppe eingereiht");
                }
            })

        })
    }

    if(user.familyId != 0 && target.user.familyId == user.familyId && target.user.isFamilyLeader) {
        interaction.add('Übertrage deine TC an eine Familie', 'Fractional', 'car',() => {
            if (!check()) return;

            if(!target.user.family.canBuyMoreCar) return user.notify('Die Familie hat die Fahrzeug-Grenze erreicht')
            if(!user.myVehicles.length) return user.notify('Du hast keine TC')
            const m = menu.new(player, 'Übergabe des Fahrzeugs an die Familie')
            user.myVehicles.map(v => {
                m.newItem({
                    name: v.model,
                    onpress: () => {
                        if (!check()) return;
                        if(!user.myVehicles.includes(v)) return;
                        if(system.distanceToPos(v.vehicle.position, player.position) > 50) return user.notify('Das Fahrzeug sollte direkt neben dir sein')
                        m.close()
                        menu.accept(target, `Spieler ${target.user.getShowingNameString(player)} (${target.user.getShowingIdString(player)}) den Fahrzeug übertragen will ${v.model} an deine Familie.`, 'small').then(status => {
                            if (!status) return;
                            if (!check()) return;
                            if(!user.myVehicles.includes(v)) return;
                            if(user.familyId == 0 || target.user.familyId != user.familyId || !target.user.isFamilyLeader) return;
                            if(!target.user.family.canBuyMoreCar) return user.notify('Die Familie hat die Fahrzeug-Grenze erreicht')
                            if (BATTLE_PASS_VEHICLES.find(el => v.model === el) !== undefined)
                                return player.notify('Du kannst keine Fahrzeuge aus einem Kampfpass übertragen');

                            // v.setOwnerFamily(target.user.family.entity, )

                            Vehicle.selectParkPlace(target, v.avia, true).then(place => {
                                if (!place) return target.notify("Beim Kauf des Fahrzeugs musst du den Stellplatz angeben, auf dem das Fahrzeug abgestellt werden soll", "error");
                                if (!check()) return;
                                if(!user.myVehicles.includes(v)) return;
                                const getParkPos = () => {
                                    if (place.type === "house") return houses.getFreeVehicleSlot(place.id, v.avia)
                                    else return parking.getFreeSlot(place.id)
                                }
                                if(user.familyId == 0 || target.user.familyId != user.familyId || !target.user.isFamilyLeader) return;
                                if (!target.user.family.canBuyMoreCar) return target.notify('Es gibt nicht genug Plätze in der Familie für ein neues Fahrzeug')
                                v.setOwnerFamily(target.user.family.entity, getParkPos());
                                user.notify(`Du hast dein TC einer Familie gegeben`)
                                target.notify('Du hast ein neues Fahrzeug in der Familie')
                            })

                        })
                    }
                })
            })

            m.open()

        })
    }

    if (!target.user.cuffed) {
        interaction.add("Romantisch", '', 'heart', () => {
            if (!check()) return;
            let subinteract = new InterractionMenu(player);
            subinteract.onBack = () => {
                playerInteract(player, targetId);
            }
            SYNC_ANIM_LIST.map(item => {
                subinteract.add(item.name, '', 'lips', () => {
                    if (!check()) return;
                    menu.accept(target, `Möchtest du die Animation abspielen ${item.name} с ${target.user.getShowingNameString(player)} (${target.user.getShowingIdString(player)})?`, 'small').then(status => {
                        if(!status) return;
                        if (!check()) return;
                        let playerAnim = typeof item.anim1 === "string" ? item.anim1 : (player.user.male ? item.anim1[0] : item.anim1[1]);
                        let targetAnim = typeof item.anim2 === "string" ? item.anim2 : (target.user.male ? item.anim2[0] : item.anim2[1]);
                        player.user.playSyncAnimation(target, [item.dict1, playerAnim], [item.dict2, targetAnim], item.dist)
                    })
                })
            })
            subinteract.open();
        })
    }

    if(!user.isFamiliar(target)) interaction.add(user.isFamiliar(target) ? "Sich wieder vertraut machen" : "Kennenlernen", 'Soziales', 'chatbubbles',() => {
        if (!check()) return;
        player.notify("Du hast angeboten, dich einem Mann vorzustellen", "success");
        menu.accept(target, "Möchtest du ihn kennenlernen? (" + player.dbid + ")", 'small').then(status => {
            if (!check()) return;
            if (!status) return player.notify("Der Mann wollte dich nicht kennenlernen", "error");


            user.newFamiliar(target, target.user.name);
            target.user.newFamiliar(player, user.name);
            if(!user.isFamiliar(target)){
                player.user.achiev.achievTickByType("newMeet")
                target.user.achiev.achievTickByType("newMeet")
            }
            player.notify("Du hast erfolgreich getroffen", "success")
            target.notify("Du hast erfolgreich getroffen", "success")

            // menu.input(player, "Как хотите представиться", user.name).then(myname => {
            //     if (!check()) return;
            //     if (!myname) {
            //         player.notify("Знакомство не состоялось", "error")
            //         target.notify("Знакомство не состоялось", "error")
            //         return;
            //     }
            //     menu.input(target, "Как хотите запомнить человека?", myname).then(myname => {
            //         if (!check()) return;
            //         if (!myname) {
            //             player.notify("Знакомство не состоялось", "error")
            //             target.notify("Знакомство не состоялось", "error")
            //             return;
            //         }
            //         menu.input(target, "Как хотите представиться", target.user.name).then(targetname => {
            //             if (!check()) return;
            //             if (!targetname) {
            //                 player.notify("Знакомство не состоялось", "error")
            //                 target.notify("Знакомство не состоялось", "error")
            //                 return;
            //             }
            //             menu.input(player, "Как хотите запомнить человека?", targetname).then(targetname => {
            //                 if (!check()) return;
            //                 if (!targetname) {
            //                     player.notify("Знакомство не состоялось", "error")
            //                     target.notify("Знакомство не состоялось", "error")
            //                     return;
            //                 }
            //                 user.newFamiliar(target, targetname);
            //                 target.user.newFamiliar(player, myname);
            //                 if(!user.isFamiliar(target)){
            //                     player.user.achiev.achievTickByType("newMeet")
            //                     target.user.achiev.achievTickByType("newMeet")
            //                 }
            //                 player.notify("Вы успешно познакомились", "success")
            //                 target.notify("Вы успешно познакомились", "success")
            //                 user.playSyncAnimation(target, ["mp_ped_interaction", "handshake_guy_a"], ["mp_ped_interaction", "handshake_guy_b"])
            //             })
            //         })
            //     })
            // })

        })
    })

    mp.events.call('interaction:openPlayer', player, target, interaction);

    interaction.open();
}

CustomEvent.registerClient('interractionMenu:select', (player, id: number, index: number) => {
    const m = InterractionMenu.get(id);
    if(!m) return;
    m.handle(index);
})
CustomEvent.registerClient('interractionMenu:onBack', (player, id: number) => {
    const m = InterractionMenu.get(id);
    if(!m) return;
    m.handle(99);
})
CustomEvent.registerClient('interractionMenu:onExit', (player, id: number) => {
    const m = InterractionMenu.get(id);
    if(!m) return;
    m.handle(100);
})

mp.events.add('playerDeath', player => {
    truckLeaveEvent(player)
})

mp.events.add('playerQuit', player => {
    truckLeaveEvent(player)
})

const truckLeaveEvent = (player: PlayerMp) => {
    if(!player.user) return;
    if (player.dbid && player.getVariable('inVehicleTruck')) {
        player.setVariable('inVehicleTruck', null);
        const veh = Vehicle.toArray().find(target => target.playerInTruck === player.dbid);
        if (veh) veh.playerInTruck = null
    }
}