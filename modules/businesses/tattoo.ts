import { BusinessEntity } from "../typeorm/entities/business";
import { menu } from "../menu";
import { OWNER_TYPES } from "../../../shared/inventory";
import { system } from "../system";
import {business, businessCatalogMenu, businessDefaultCostItem, clearBusinessProduct} from "../business";
import { inventory } from "../inventory";
import { CustomEvent } from "../custom.event";
import { tattoosShared } from "../../../shared/tattoos";
import { tattooRemoveCostMultipler, tattooRemoveMoneySendToBusinessMultipler } from "../../../shared/economy";
import { BUSINESS_TYPE } from "../../../shared/business";
import { needUnload, deliverSet, orderDeliverMenu } from "./order.system";
import {getAchievConfigBiz} from "../../../shared/achievements";
import {canUserStartBizWar, createBizMenuBizWarItem} from "../bizwar";
import {writeClientRatingLog} from "./tablet";

CustomEvent.registerCef('tattoo:buy', (player, shopId: number, itemId: number) => {
    if (!player.user) return;
    const user = player.user;
    if(user.tattoos.length >= 20) return player.notify('Du bist bereits überfordert', 'error')
    let shop = business.get(shopId);
    if (!shop) return player.notify("Falsches Geschäft", "error"), reloadShopData(player, shop);
    if (shop.type !== BUSINESS_TYPE.TATTOO_SALON) return player.notify("Das Geschäft ist kein Tattoo-Studio", "error"), reloadShopData(player, shop);
    const conf = shop.catalog.find(q => q.item == itemId);
    if (!conf) return player.notify('Tattoos sind nicht mehr käuflich', 'error'), reloadShopData(player, shop);
    let tattooCfg = tattoosShared.getTattoo(conf.item);
    if (!tattooCfg) return player.notify('Tattoos sind nicht mehr zu verkaufen', 'error'), reloadShopData(player, shop);
    if (!conf || !conf.price) return player.notify('Tattoos sind nicht mehr zu verkaufen', 'error'), reloadShopData(player, shop);
    if (conf.count <= 0 && shop.userId) return player.notify('Der Meister hat keinen passenden Rohling für dieses Tattoo.', 'error')
    if (shop.donate) {
        if (user.donate_money < conf.price) return player.notify('Du hast nicht genug Coins zum Bezahlen', 'error')
    } else {
        if (user.money < conf.price) return player.notify('Du hast nicht genügend Geld, um zu bezahlen', 'error')
    }
    if(conf.count){
        shop.setItemCountByItemId(conf.item, conf.count - 1)
        business.addMoney(shop, conf.price, `Kunde (${player.dbid}) hat ein Tattoo bekommen ${tattooCfg.name}`, false,
            false, true, true, businessDefaultCostItem(shop, conf.item));
    }
    if (shop.donate) {
        user.removeDonateMoney(conf.price, `Ich habe ein Tattoo`)
    } else {
        user.removeMoney(conf.price, true, 'Ich habe ein Tattoo');
        player.user.achiev.setAchievTickBiz(shop.type, shop.sub_type, conf.price)
    }
    user.newTattoo(tattooCfg.collection, user.male ? tattooCfg.overlay_male : tattooCfg.overlay_female)
    writeClientRatingLog(player, shopId, conf.price, tattooCfg.name, 1);
    player.notify("Der Meister hat die Tätowierung fertiggestellt", "success");
    reloadShopData(player, shop);
})


CustomEvent.registerCef('tattoo:remove', (player, shopId: number, itemId: number, removePrice: number) => {
    if (!player.user) return;
    const user = player.user;
    let shop = business.get(shopId);
    if (!shop) return player.notify("Unfaire Geschäfte.", "error"), reloadShopData(player, shop);
    if (shop.type !== BUSINESS_TYPE.TATTOO_SALON) return player.notify("Das Geschäft ist kein Tattoo-Studio", "error"), reloadShopData(player, shop);
    const q = user.tattoos[itemId];
    if (!q) return player.notify('Das Tattoo ist bereits entfernt worden', 'error');
    let tattooCfg = tattoosShared.findTattoo(q[0], q[1])
    if(user.haveTattoo(tattooCfg.collection, user.male ? tattooCfg.overlay_male : tattooCfg.overlay_female)){
        if (user.money < tattooCfg.price * tattooRemoveCostMultipler) return player.notify("Unzureichende Mittel zur Bezahlung", "error");
        user.removeMoney(tattooCfg.price * tattooRemoveCostMultipler, true, 'Ich habe ein Tattoo');
        user.removeTattoo(tattooCfg.collection, user.male ? tattooCfg.overlay_male : tattooCfg.overlay_female);
        business.addMoney(shop, tattooCfg.price * tattooRemoveCostMultipler * tattooRemoveMoneySendToBusinessMultipler, `Kunde (${player.dbid}) ein Tattoo bekommen ${tattooCfg.name}`);
        player.notify("Das Tattoo wurde erfolgreich verschmolzen", "success");
        reloadShopData(player, shop);
        return;
    }
})


const reloadShopData = (player: PlayerMp, item: BusinessEntity) => {
    let catalog: { item_id: number, count: number, price: number }[] = [];
    item.catalog.map(data => {
        if (!data.price) return;
        if (!data.count && item.userId) return;
        let cfg = tattoosShared.getTattoo(data.item);
        if(!cfg) return;
        if(player.user.male && !cfg.overlay_male) return;
        if(!player.user.male && !cfg.overlay_female) return;
        catalog.push({ item_id: data.item, price: data.price, count: data.count })
    })
    if (player.dimension === 0) {
        player.user.teleport(item.positions[0].x, item.positions[0].y, item.positions[0].z, item.positions[0].h, player.id + 1)
        player.user.undress();
    }
    CustomEvent.triggerClient(player, "tattooshop:open", item.id, item.name, item.sub_type, catalog, player.user.tattoos, item.positions[0].h)
}


CustomEvent.registerClient('tattoo:exit', player => {
    player.user.reloadSkin();
    player.dimension = 0;
})

export const tattooMenu = (player: PlayerMp, item: BusinessEntity) => {
    if (!player.user) return;
    const user = player.user;
    const openShop = () => {
        if (item.catalog.length == 0) return player.notify('Der Salonkatalog ist derzeit leer', 'error');
        if(!user.mp_character) return player.notify('Du nutzt ein Tattoo-Studio und verwendest eine nicht standardisierte Haut', 'error')
        reloadShopData(player, item)
    }
    if (!user.isAdminNow(6) && item.userId !== user.id && !needUnload(player, item) && !canUserStartBizWar(user))
        return openShop();
    let m = menu.new(player, "", user.isAdminNow(6) ? `Business #${item.id}` : "");
    let sprite = "";
    switch (item.sub_type) {
        case 0:
            m.sprite = "shopui_title_tattoos";
            break;
        case 1:
            m.sprite = "shopui_title_tattoos2";
            break;
        case 2:
            m.sprite = "shopui_title_tattoos3";
            break;
        case 3:
            m.sprite = "shopui_title_tattoos4";
            break;
        case 4:
            m.sprite = "shopui_title_tattoos5";
            break;
        default:
            m.title = 'Tattoo-Salon'
            break;
    }
    m.sprite = sprite as any;

    m.newItem({
        name: "Produktkatalog",
        onpress: () => {
            m.close();
            openShop()
        },
    })
    if (needUnload(player, item)){
        m.newItem({
            name: "~g~Auftrag abladen",
            onpress: () => {
                m.close();
                deliverSet(player)
            },
        })
    }

    createBizMenuBizWarItem(user, m, item);
    
    if (user.isAdminNow(6) || item.userId === user.id) {
        m.newItem({
            name: '~b~Business Management',
            onpress: () => {
                businessCatalogMenu(player, item, () => {
                    tattooMenu(player, item)
                })
            },
        })
        m.newItem({
            name: '~g~Produktbestellung',
            onpress: () => {
                orderDeliverMenu(player, item)
            }
        })
    }

    




    m.open();
};