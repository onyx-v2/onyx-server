import { PayData, PayType } from "../../../shared/pay";
import { BUSINESS_SUBTYPE_NAMES, BUSINESS_TYPE, getFuelCost } from "../../../shared/business";
import { fuelTypeNames, VEHICLE_FUEL_TYPE } from "../../../shared/vehicles";
import {business, businessCatalogMenu, businessDefaultCostItem} from "../business";
import { CustomEvent } from "../custom.event";
import { menu } from "../menu";
import { system } from "../system";
import { BusinessEntity } from "../typeorm/entities/business";
import { Vehicle } from "../vehicles";
import { deliverSet, needUnload, orderDeliverMenu } from "./order.system";
import {inventoryShared} from "../../../shared/inventory";
import {getAchievConfigBiz} from "../../../shared/achievements";
import {canUserStartBizWar, createBizMenuBizWarItem, startBizWar} from "../bizwar";
import {writeClientRatingLog} from "./tablet";


export const azsMenuOpenEvent = (player: PlayerMp, shop: BusinessEntity, electro: boolean) => {
    const user = player.user;
    if (!user) return;
    const vehicle = player.vehicle;
    if(!vehicle){
        const item = inventoryShared.get(!electro ? 817 : 862)
        if(!item || !item.defaultCost) return player.notify('Um eine Tankstelle zu eröffnen, musst du im Fahrzeug sein', "error");

        menu.accept(player, `Du willst kaufen ${item.name} zugunsten von $${system.numberFormat(item.defaultCost)}`).then(status => {
            if(!status) return;
            if(user.money < item.defaultCost) return player.notify('Du hast nicht genügend Geld, um zu bezahlen', 'error');
            if(!user.tryGiveItem(item.item_id, true, true)) return;
            user.removeMoney(item.defaultCost, true, `Kaufen ${item.name} an der Pumpe`);
            business.addMoney(shop, item.defaultCost * 0.7, `Kaufen ${item.name}`);
        })

        return;
    }
    if (!vehicle) return player.notify('Um eine Tankstelle zu eröffnen, musst du im Fahrzeug sein', "error");
    if (!user.isDriver) return player.notify('Du solltest fahren', "error");
    const vehconf = Vehicle.getVehicleConfig(vehicle);
    if(!vehconf) return player.notify('Dieses Fahrzeug kann nicht betankt werden, wir wissen nicht, was dafür geeignet ist.', 'error');
    CustomEvent.triggerClient(player, 'fuel:open', electro, shop.catalog, shop.id, shop.name, Vehicle.getFuel(vehicle), Vehicle.getFuelMax(vehicle))
}

CustomEvent.registerCef('fuel:add', async (player, id: number, amount: number, payType: PayType, pin: string, electro: boolean, selectedFuel: VEHICLE_FUEL_TYPE) => {
    const user = player.user;
    if (!user) return "Fehler";
    const veh = player.vehicle;
    if (!veh) return "Du musst im Transporter sein, um ihn zu bekommen " + (electro ? "Ladung" : "tuck");
    if (!user.isDriver) return 'Du solltest fahren';
    const vehconf = Vehicle.getVehicleConfig(veh);
    if (!vehconf) return 'Dieses Fahrzeug kann nicht betankt werden, wir wissen nicht, was dafür geeignet ist.';
    const biz = business.get(id);
    if(!biz) return "Du triffst auf eine kaputte Tankstelle, oder sie wurde abgebaut, während du tanken wolltest.";
    if (biz.type !== BUSINESS_TYPE.FUEL) return "Du hast eine kaputte Tankstelle erwischt, oder vielleicht ist es gar keine Tankstelle";
    if(electro && vehconf.fuel_type !== VEHICLE_FUEL_TYPE.ELECTRO) return "Elektrische Betankung ist für dieses Fahrzeug nicht geeignet";
    if(!electro && vehconf.fuel_type === VEHICLE_FUEL_TYPE.ELECTRO) return "Dieses Fahrzeug muss elektrisch aufgetankt werden";
    if (vehconf.fuel_type !== selectedFuel) return "Die gewählte Kraftstoffart ist für dieses Fahrzeug nicht geeignet";

    const item = biz.catalog.find(q => q.item === selectedFuel);
    if (!item) return "Die ausgewählte Kraftstoffart ist an dieser Tankstelle nicht verfügbar";
    let sum: number;
    if(item.count < amount) sum = getFuelCost(selectedFuel) * amount;
    else sum = item.price * amount;

    if(payType === PayType.COMPANY && (!user.fractionData || !user.fractionData.gos)) return "Du kannst nicht auf Kosten des Unternehmens auftanken";
    if(payType === PayType.COMPANY && veh.fraction !== user.fraction) return "Nur Firmenfahrzeuge können auf Kosten des Unternehmens betankt werdenи";

    if (payType === PayType.CASH && user.money < sum) return "Du hast nicht genug Geld";

    if (payType === PayType.CARD && !user.tryRemoveBankMoney(sum, true, `Tanken ${vehconf.name} ${fuelTypeNames[selectedFuel]} ${amount}${electro ? 'kW' : 'l'}`, `${BUSINESS_SUBTYPE_NAMES[biz.type][biz.sub_type]} #${biz.id}`)) return "Du hast nicht genug Geld";
    if (payType === PayType.CASH) user.removeMoney(sum, true, `Tanken ${vehconf.name} ${fuelTypeNames[selectedFuel]} ${amount}${electro ? 'kW' : 'l'} ${BUSINESS_SUBTYPE_NAMES[biz.type][biz.sub_type]} #${biz.id}`);
    Vehicle.addFuel(veh, amount);
    if([PayType.CASH, PayType.CARD].includes(payType)) player.user.achiev.setAchievTickBiz(biz.type, biz.sub_type, sum)
    writeClientRatingLog(player, biz.id, businessDefaultCostItem(biz, biz.catalog.find(s => s.item === selectedFuel).item, 1), fuelTypeNames[selectedFuel], amount);
    player.notify(`Transport ${electro ? "geladen" : "angeheizt"}`, "success");
    if(item.count >= amount){
        const o = [...biz.catalog]
        const fuelItem = o.find(s => s.item === selectedFuel);
        fuelItem.count -= amount;
        biz.catalog = o;
        business.addMoney(biz, sum, `Kauf von Kraftstoff ${fuelTypeNames[selectedFuel]} ${amount}${electro ? 'kW' : 'l'}`,
            false, false, true, true, businessDefaultCostItem(biz, fuelItem.item, amount));
    }
    return "";
})

export const azsMenuBase = (player: PlayerMp, item: BusinessEntity, electro: boolean) => {
    const user = player.user;
    if(!user) return;
    if (!user.isAdminNow(6) && item.userId !== user.id && !needUnload(player, item) && !canUserStartBizWar(user))
        return azsMenuOpenEvent(player, item, electro);
    const m = menu.new(player, '', 'Tanken');
    m.sprite = "shopui_title_gasstation";

    if (needUnload(player, item)){
        m.newItem({
            name: "~g~Auftrag abladen",
            onpress: () => {
                m.close();
                deliverSet(player)
            },
        })
    }

    m.newItem({
        name: "Menü Tanken",
        onpress: () => {
            m.close();
            azsMenuOpenEvent(player, item, electro);
        },
    })

    createBizMenuBizWarItem(user, m, item);
    
    if (user.isAdminNow(6) || item.userId === user.id){

        m.newItem({
            name: '~g~Produktbestellung',
            onpress: () => {
                orderDeliverMenu(player, item)
            }
        })


        m.newItem({
            name: 'Business Management',
            onpress: () => {

                businessCatalogMenu(player, item, () => {
                    azsMenuBase(player, item, electro)
                })
            }
        })

    }

    m.open();
}