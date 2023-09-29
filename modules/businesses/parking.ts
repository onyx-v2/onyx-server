import {menu} from "../menu"
import {colshapes} from "../checkpoints";
import {
    BUSINESS_REWARD_PERCENT, IParkingData, IParkingFloor,
    PARKING_AVIA,
    PARKING_AVIA_EXIT,
    PARKING_CARS,
    PARKING_CARS_PLAYER_MAX,
    PARKING_DAY_COST,
    PARKING_EXIT,
    PARKING_START_COST,
    PARKING_STEP
} from "../../../shared/parking";
import {BusinessEntity} from "../typeorm/entities/business";
import {business} from "../business";
import {system} from "../system";
import {CustomEvent} from "../custom.event";
import {User} from "../user";
import {Vehicle} from "../vehicles";
import {writeClientRatingLog} from "./tablet";

export const parkingMenu = async (player: PlayerMp, item?: BusinessEntity) => {
    const user = player.user;
    if (!user) return;
    if (!item) item = parking.getParkingFromDimension(player.dimension);
    if (!item) return player.notify('Du brauchst die Hilfe der Verwaltung, denn du steckst fest', "error");
    let slots = parking.getParkingZones(item);
    if (player.vehicle) {
        const veh = player.vehicle
        if (!veh.entity) return player.notify("Der Parkplatz ist nur für Fahrzeuge, die dem Bewohner gehören", "error");
        if (!user.isDriver) return player.notify("Nur für den Fahrer verfügbar", "error");
        let slot = slots.find(q => q.veh === player.vehicle);
        if (!slot) {
            if (veh.entity.owner != player.dbid) return player.notify("Dieses Auto ist nicht auf diesem Parkplatz zugelassen und kann nur vom Besitzer hier geparkt werden.", "error");
            if (slots.filter(q => !q.veh).length === 0) return player.notify("Es gibt keinen Platz im Parkhaus", "error")
            if((item.sub_type === 1) !== veh.entity.avia) return player.notify(`Dieser Parkplatz ist nicht geeignet für${veh.entity.name}`, 'error');
            const allVehs = parking.allVehsInAllParking()
            const myCarsOnParks = allVehs.filter(veh => veh.entity.owner === user.id && veh.entity.id !== player.vehicle.entity.id).length
            if (myCarsOnParks >= PARKING_CARS_PLAYER_MAX) {
                return player.notify(`Neue Parkplätze stehen dir nicht zur Verfügung, weil du bereits einen hast ${myCarsOnParks} Fahrzeug auf dem Parkplatz`, 'error');
            }
            if (!(await menu.accept(player, `Das Fahrzeug in einem Parkhaus abstellen? Kosten $${system.numberFormat(PARKING_START_COST)} + $${system.numberFormat(PARKING_DAY_COST)} pro Tag`))) return;
            if (!parking.getFreeSlot(item)) return player.notify("Es gibt keine freien Parkplätze mehr", "error");
            if (!(await user.tryPayment(PARKING_START_COST, 'all', () => {
                slot = parking.getFreeSlot(item);
                return !!slot
            }, 'Bezahlung für das Parken', 'Parken #' + item.id))) return;
            if (!mp.vehicles.exists(veh)) return;
            veh.entity.position = {
                x: slot.x,
                y: slot.y,
                z: slot.z,
                h: slot.h,
                d: slot.d,
            }
            player.notify("Du hast das Fahrzeug erfolgreich geparkt", "success");
            writeClientRatingLog(player, item.id, PARKING_START_COST, "Zuhause Parken", 1);
        }
        if (slot) {
            user.teleportVeh(slot.x, slot.y, slot.z, slot.h, slot.d);
            veh.entity.engine = false;
            veh.entity.locked = true;
            setTimeout(() => {
                if (mp.vehicles.exists(veh)) {
                    veh.getOccupants().filter(target => mp.players.exists(target) && target.user).map(target => target.user.leaveVehicle())
                    veh.entity.engine = false;
                    veh.entity.locked = true;
                }
            }, system.TELEPORT_TIME)
            return;
        }

        return;
    }

    const poss = item.sub_type == 0 ? PARKING_CARS : PARKING_AVIA;

    function GetParkingFloors(item: BusinessEntity): IParkingFloor[] {
        let floors: IParkingFloor[] = [];

        for (let id = 0; id <= item.upgrade; id++) {
            const dim = parking.getFloorForDimension(item, id),
            slot = slots.filter(q => q.d === dim && q.veh),
            haveCar = slot.find(q => q.veh.entity.owner === player.dbid);

            const floor: IParkingFloor = {
                dimension: dim,
                serial: id + 1,
                current: dim === player.dimension,
                haveCar: !!haveCar,
                places: `${slot.length} / ${poss.length}`,
                freePlaces: slot.length < poss.length
            }

            floors.push(floor);
        }

        return floors;
    }

    const ParkingData: IParkingData = {
        id: item.id,
        name: item.name,
        exit: player.dimension !== 0 ? [
            new mp.Vector3(item.positions[0].x, item.positions[0].y, item.positions[0].z),
            item.positions[0].h,
            0
        ] : null,
        floors: GetParkingFloors(item),
        singlePayment: system.numberFormat(PARKING_START_COST),
        dailyPayment: system.numberFormat(PARKING_DAY_COST),
        subType: item.sub_type
    }

    user.setGui('parking');
    CustomEvent.triggerCef(player, 'parking:load', ParkingData);


    /*
    const m = menu.new(player, `Парковка #${item.id}`, item.name);

    if (player.dimension !== 0) {
        m.newItem({
            name: "Выйти на улицу",
            onpress: () => {
                m.close();
                user.teleport(item.positions[0].x, item.positions[0].y, item.positions[0].z, item.positions[0].h, 0);
            }
        })
    }
    const poss = item.sub_type == 0 ? PARKING_CARS : PARKING_AVIA
    const exit = item.sub_type == 0 ? PARKING_EXIT : PARKING_AVIA_EXIT
    for (let id = 0; id <= item.upgrade; id++) {
        const dim = parking.getFloorForDimension(item, id);
        let slot = slots.filter(q => q.d === dim && q.veh);
        const haveCar = slot.find(q => q.veh.entity.owner === player.dbid);
        m.newItem({
            name: `${dim === player.dimension ? 'Текущий ' : ''}Этаж: ${(id + 1)}${haveCar ? ' 🚗': ''}`,
            more: `${slot.length} / ${poss.length}`,
            desc: `${haveCar ? `~g~На данном этаже есть транспорт который вам принадлежит` : `~r~На данном этаже нет транспорта который вам принадлежит`}`,
            onpress: () => {
                if (dim === player.dimension) return player.notify("Вы уже на этом этаже", "error");
                user.teleport(exit.x, exit.y, exit.z, player.heading, dim);
            }
        })
    }
        m.newItem({
        name: 'Тариф',
        desc: `Единоразовая оплата: $${system.numberFormat(PARKING_START_COST)}. Посуточная оплата: $${system.numberFormat(PARKING_DAY_COST)}`
    })
        if (user.isAdminNow(6) || item.userId === user.id) {
        m.newItem({
            name: '~b~Управление'
        })
        m.newItem({
            name: 'Количество транспорта',
            more: `${slots.filter(q => q.veh).length} / ${slots.length}`
        })
        if (user.isAdminNow(6)) {
            m.newItem({
                name: "~r~Удалить парковку",
                onpress: () => {
                    menu.accept(player).then(status => {
                        if(!status) return;
                        let slots = parking.getParkingZones(item);
                        slots.map(data => {
                            if(!data.veh) return;
                            data.veh.entity.moveToParkingFine(0, false)
                        })
                        business.delete(item);

                    })
                }
            })
        }

    }


    m.open();
     */
}

CustomEvent.registerCef('parking:exit', (player: PlayerMp, pos: Vector3Mp, heading: number, dimension: number) => {
    player.user.teleport(pos.x, pos.y, pos.z, heading, dimension);
});

CustomEvent.registerCef('parking:toFloor', (player: PlayerMp, dimension: number, sub_type: number) => {
    if (dimension === player.dimension) return player.notify("Du bist bereits auf dieser Etage", "error");
    const pos = sub_type == 0 ? PARKING_EXIT : PARKING_AVIA_EXIT;
    player.user.teleport(pos.x, pos.y, pos.z, player.heading, dimension);
});

CustomEvent.register('newDay', () => {
    const data = parking.allVehsInAllParking();
    let targets = new Map<number, number>();
    let parkingsReward = new Map<number, number>();
    data.map(veh => {
        if (targets.has(veh.entity.owner)) {
            targets.set(veh.entity.owner, targets.get(veh.entity.owner) + PARKING_DAY_COST);
        } else {
            targets.set(veh.entity.owner, PARKING_DAY_COST);
        }
        let biz = parking.getParkingFromDimension(veh.entity.position.d);
        if(biz){
            if (parkingsReward.has(biz.id)) {
                parkingsReward.set(biz.id, parkingsReward.get(biz.id) + PARKING_DAY_COST);
            } else {
                parkingsReward.set(biz.id, PARKING_DAY_COST);
            }
        }
    })
    targets.forEach((sum, owner) => {
        User.getData(owner).then(data => {
            if(!data) return;
            if (data.bank_number) {
                User.writeBankNotify(owner, data.bank_money >= sum ? 'remove' : 'reject', sum, 'Tägliche Parkgebühr', 'Парковка')
                if (data.bank_money >= sum) {
                    data.bank_money -= sum;
                    data.save()
                }
            }
        })
    })
    parkingsReward.forEach((sum, biz) => {
        business.addMoney(biz, (sum / 100 * BUSINESS_REWARD_PERCENT), 'Einnahmen aus dem täglichen Parken')
    })
})

mp.events.add("playerEnterVehicle", (player, vehicle, seat) => {
    if(!vehicle) return;
    if (!player.user) return;
    if (!vehicle.dbid) return;
    if (!player.dimension) return;
    if (vehicle.getOccupant(0) != player) return;
    let item = parking.getParkingFromDimension(vehicle.dimension);
    if (!item) return;
    let zone = parking.getParkingZones(item);
    if (zone.find(q => q.veh === vehicle)) {
        vehicle.entity.engine = true;
        player.user.teleportVeh(item.positions[0].x, item.positions[0].y, item.positions[0].z, item.positions[0].h, 0);
        setTimeout(() => {
            Vehicle.repair(vehicle)
        }, system.TELEPORT_TIME + 1000)
    }
});


export const parking = {
    getFreeSlot: (biz: BusinessEntity | number) => {
        const item = typeof biz === "number" ? business.get(biz) : biz;
        const frees = parking.getParkingZones(item).filter(q => !q.veh);
        if(frees.length == 0) return null;
        return system.randomArrayElement(frees)
    },
    getParkingZones: (item: BusinessEntity) => {
        let items: { x: number, y: number, z: number, h: number, d: number, veh?: VehicleMp }[] = []
        let dims: number[] = [];
        for (let id = 0; id <= item.upgrade; id++) {
            dims.push(parking.getFloorForDimension(item, id));
        }
        const allVehs = parking.allVehsInAllParking().filter(veh => dims.includes(veh.entity.position.d));
        const poss = item.sub_type == 0 ? PARKING_CARS : PARKING_AVIA
        const range = item.sub_type == 0 ? 3 : 8
        poss.map(pos => {
            dims.map(d => {
                items.push({ ...pos, d, veh: allVehs.find(veh => veh.entity && veh.entity.position && d === veh.entity.position.d && system.distanceToPos(veh.entity.position, pos) < range) })
            })
        })
        return items;
    },
    allVehsInAllParking: () => {
        return Vehicle.toArray().filter(veh => veh.entity && !veh.entity.onParkingFine && veh.entity.position && system.isPointInPoints(veh.entity.position, [...PARKING_CARS, ...PARKING_AVIA], 10))
    },
    getFloorForDimension: (item: BusinessEntity, floor = 0) => {
        return (item.id * PARKING_STEP) + floor
    },
    getParkingFromDimension: (dimension: number) => {
        if (dimension < PARKING_STEP) return null;
        let i = Math.floor(dimension / PARKING_STEP)
        return business.get(i)
    }
}


colshapes.new([PARKING_EXIT, PARKING_AVIA_EXIT], "Parken", player => {
    parkingMenu(player)
}, { dimension: -1, type: 27, color: [0, 0, 120, 200] })