import {CustomEvent} from "../custom.event";
import {
    DICE_PLAY_COUNT,
    DICE_PLAY_START_TIME,
    DICE_PLAY_TIME, DICE_PLAY_WAIT_TIME,
    DICE_TABLE_SETTINGS,
    DICE_TABLES_LIST,
    DiceData,
    DicePlayer
} from "../../../shared/casino/dice";
import {User} from "../user";
import {SocketSyncWeb} from "../socket.sync.web";
import {system} from "../system";
import {colshapes} from "../checkpoints";
import {CASINO_MAIN_DIMENSION} from "../../../shared/casino/main";
import {LEVEL_PERMISSIONS} from "../../../shared/level.permissions";
import {runCasinoAchievWin} from "./achiev";
import {VIP_TARIFS} from "../../../shared/vip";


let tables = new Map<number, DiceData>();


colshapes.new(new mp.Vector3(DICE_TABLE_SETTINGS.DRESS_POS.x, DICE_TABLE_SETTINGS.DRESS_POS.y, DICE_TABLE_SETTINGS.DRESS_POS.z), `Umkleideraum`, player => {
    const user = player.user;
    if(!user) return;
    if(player.inCasinoDress){
        user.setJobDress(null);
        player.inCasinoDress = false;
        return player.notify('Du hast deine Arbeitskleidung ausgezogen', 'success');
    }
    if(user.level < LEVEL_PERMISSIONS.CASINO_DEALER) return player.notify(`Erhältlich bei ${LEVEL_PERMISSIONS.CASINO_DEALER} LVL`, 'error');
    player.inCasinoDress = true
    user.setJobDress(user.is_male ? DICE_TABLE_SETTINGS.DRESS_MALE : DICE_TABLE_SETTINGS.DRESS_FEMALE);
    player.notify('Du hast deine Arbeitskleidung angezogen. Der Job des Croupiers steht dir jetzt offen', 'success');
}, {
    type: 27,
    dimension: CASINO_MAIN_DIMENSION,
    drawStaticName: 'scaleform'
})

DICE_TABLES_LIST.map((q, i) => {
    tables.set(i, {
        stage: 'wait',
        players: [null, null, null, null],
        id: i,
        bet: 0,
        betsum: 0,
    })
    if(typeof q.npc === "number") setTimeout(() => {
        autoStart(i);
    }, 35000)
})

CustomEvent.registerClient('casino:dice:enter', (player, table: number, seat: number) => {
    const user = player.user;
    check(table);
    const cfg = DICE_TABLES_LIST[table];
    if (!cfg) return 'Tabelle nicht erkannt. Fehler';
    if (cfg.isVip && (!user.vipData || !user.vipData.casino)) return `Der Tisch ist nur für VIP-Mitglieder. Die VIP-Mitgliedschaft erhältst du durch den Kauf von ${VIP_TARIFS.filter(q => !q.media && q.casino).map(q => q.name).join(', ')}`;
    let data = tables.get(table);
    if (!data) return 'Tabelle nicht gefunden';
    // if (data.stage !== 'wait') return 'Во время игры нельзя зайти на стол';
    if (seat === 9999) {
        if (typeof cfg.npc === "number" || data.croupier) return 'Der Platz des Croupiers ist besetzt';
        if(!player.inCasinoDress) return 'Zieh deine Arbeitsuniform an';
        tables.set(table, {...data, croupier: player.dbid});
    } else {
        if(typeof seat !== "number" || seat < 0 || seat > 3) return 'Es ist der falsche Ort';
        if (data.players[seat]) return 'Sitzplatz besetzt';
        if (data.players.find(q => q && q.id === user.id)) return 'Du hast bereits einen anderen Platz eingenommen';
        if(player.inCasinoDress) return 'Der Croupier kann nicht spielen';
        if(player.user.getJobDress) return 'Zieh deine Arbeitskleidung aus, bevor du anfängst zu spielen';
        let players:[DicePlayer, DicePlayer, DicePlayer, DicePlayer] = [...data.players];
        players[seat] = {
            id: user.id,
            name: user.name,
            stage: 'wait'
        };
        tables.set(table, {...data, players});
    }

    updateTableData(table);
    user.currentWeapon = null;
    return tables.get(table);
})

const updateTableData = (id: number) => {
    const data = tables.get(id);
    if(!data) return;
    SocketSyncWeb.fire(`dice_${id}`, JSON.stringify(data))
}

CustomEvent.registerCef('casino:dice:bet', (player, table: number) => {
    const user = player.user;
    check(table);
    const cfg = DICE_TABLES_LIST[table];
    if (!cfg) return player.notify('Tabelle nicht gefunden', 'error');
    const data = tables.get(table);
    if (data.stage !== 'wait') return player.notify('Wetten werden nicht mehr angenommen', 'error');
    const myPos = data.players.findIndex(q => q && q.id === user.id);
    if (myPos === -1) return player.notify('Du bist kein Mitglied des Tisches', 'error');
    if (data.players[myPos].stage !== "wait") return player.notify('Du hast deine Wette bereits abgegeben', 'error');
    const sum = data.bet;
    if (!sum) return player.notify('Das Angebot ist noch nicht ausgewählt worden', 'error');
    if (user.chips < sum) return player.notify('Du hast nicht genug Chips zum Setzen', 'error');
    user.removeChips(sum, false, `Der Pflock im Knochen`);
    user.playAnimation([[`anim_casino_b@amb@casino@games@threecardpoker@ped_${user.feemale ? 'fe' : ''}male@regular@01a@play@v02`, 'bet_plus']], true)
    data.betsum += data.bet
    data.players[myPos].stage = 'ready';
    tables.set(table, data);
    updateTableData(table);
})

const betCancel = (player: PlayerMp, table: number, exit = false) => {
    const user = player.user;
    if(!exit) check(table);
    const cfg = DICE_TABLES_LIST[table];
    if (!cfg) return;
    const data = tables.get(table);
    if (!['wait', 'ready'].includes(data.stage)) return;
    const myPos = data.players.findIndex(q => q && q.id === user.id);
    if (myPos === -1) return;
    if (data.players[myPos].stage !== "ready") return;
    const sum = data.bet;
    data.betsum -= data.bet;
    user.addChips(sum, false, `Annullierung einer Wette beim Würfeln`);
    data.players[myPos].stage = 'wait';
    if(!exit) user.playAnimation([[`anim_casino_b@amb@casino@games@threecardpoker@ped_${user.feemale ? 'fe' : ''}male@regular@01a@play@v02`, 'collect_chips']], true)
    tables.set(table, data);
    if(!exit) updateTableData(table);
}

CustomEvent.registerCef('casino:dice:betCancel', (player, table: number) => {
    betCancel(player, table)
})
CustomEvent.registerCef('casino:dice:roll', (player, table: number, res: number) => {
    const user = player.user;
    check(table);
    const cfg = DICE_TABLES_LIST[table];
    if (!cfg) return;
    let data = tables.get(table);
    if (data.stage !== 'dice') return player.notify('Zum Aufhören ist es zu spät', 'error');
    const myPos = data.players.findIndex(q => q && q.id === user.id);
    if (myPos === -1) return player.notify('Du bist kein Mitglied des Tisches', 'error');
    if (data.players[myPos].stage !== "dice") return player.notify('Es ist zu spät für dich, um aufzuhören', 'error');
    if (!data.players[myPos].scoreArr || !data.players[myPos].score) data.players[myPos].scoreArr = [];
    data.players[myPos].score += res;
    data.players[myPos].scoreArr.push(res)
    if (data.players[myPos].scoreArr.length === DICE_PLAY_COUNT) {
        data.players[myPos].stage = 'ok';
        user.playAnimation([[`anim_casino_b@amb@casino@games@threecardpoker@ped_${user.feemale ? 'fe' : ''}male@regular@01a@play@v02`, 'bet_ante']], true)
    }
    tables.set(table, data);
    updateTableData(table);
})

const clearTable = async (id: number) => {
    check(id);
    let data: DiceData;
    data = tables.get(id);
    data.stage = 'wait';
    let players: any = [];
    data.players.map(player => {
        if (!player) return players.push(null);
        if(player.stage === 'ready'){
            const target = User.get(player.id);
            if(target) target.user.addChips(data.bet, false, 'Rückgabe einer Wette auf die Knochen')
        }
        players.push({...player, stage: 'wait', scoreArr: [], score: 0, time: 0})
    })
    data.betsum = 0;
    data.bet = 0;
    tables.set(id, {...data, players});
    updateTableData(id);
}

CustomEvent.registerCef('casino:dice:start', (player, table: number) => {
    check(table);
    const q = tables.get(table);
    if (!q) return;
    if (q.croupier !== player.dbid) return player.notify('Du bist kein Croupier, um ein Spiel zu beginnen', 'error')
    if(q.players.filter(s => s && s.stage === 'ready').length < 2) return player.notify('Nicht genug Teilnehmer für den Start', 'error');
    startTable(table);
})

const autoStart = async (id: number) => {
    clearTable(id)
    const cfg = DICE_TABLES_LIST[id];
    if (!cfg) return;
    if (typeof cfg.npc !== "number") return;
    let data: DiceData;
    data = tables.get(id);
    data.bet = system.randomArrayElement(cfg.betsSum);
    tables.set(id, data);
    updateTableData(id);
    await system.sleep(DICE_PLAY_WAIT_TIME * 1000);
    startTable(id);
}

const startTable = async (id: number) => {
    check(id);
    let data: DiceData;

    data = tables.get(id);
    data.stage = 'ready';
    data.players.map(player => {
        if (!player) return;
        player.scoreArr = [];
        player.score = 0;
    })
    tables.set(id, data);
    updateTableData(id);
    await system.sleep(DICE_PLAY_START_TIME * 1000);

    check(id);
    data = tables.get(id);

    if(data.players.filter(q => q && q.stage === 'ready').length < 2) {
        data.players.map(q => {
            if(!q) return;
            const z = User.get(q.id)
            if(z) z.notify('Nicht genug Teilnehmer für den Start', 'error')
        })
        if(data.croupier){
            const z = User.get(data.croupier)
            if(z) z.notify('Nicht genug Teilnehmer für den Start', 'error')
        }
        return autoStart(id);
    }

    data.stage = 'dice';
    data.players.map(player => {
        if (!player) return;
        player.scoreArr = [];
        player.score = 0;
    })
    tables.set(id, data);
    updateTableData(id);

    let ok = false;
    while(!ok){
        ok = true;
        for (let i = 0; i < 4; i++) {
            check(id);
            data = tables.get(id);
            const target = data.players[i];
            if (target && target.stage === 'ready') {
                data.players[i].stage = 'dice';
                tables.set(id, data);
                updateTableData(id);
                let next = false;
                let q = DICE_PLAY_TIME * DICE_PLAY_COUNT
                await system.sleep(1000)
                while (!next) {
                    check(id);
                    data = tables.get(id);
                    q--;
                    if (q <= 0 || !data.players[i] || data.players[i].stage === 'ok') {
                        next = true
                        if (data.players[i]) {
                            data.players[i].stage = 'ok';
                            if (!data.players[i].score) data.players[i].score = 0;
                            tables.set(id, data);
                        }
                    }
                    await system.sleep(1000)
                }
                await system.sleep(5000)
            }
        }
        let res: { score: number }[] = [];
        check(id);
        data = tables.get(id)
        data.players.map(player => {
            if(!player) return;
            if(player.stage !== 'ok') return;
            res.push({score: player.score});
        })
        if(res.length > 1){
            res = system.sortArrayObjects(res, [{id: 'score', type: "DESC"}]);
            if(res[0].score === res[1].score) {
                ok = false;
                data.players.map(player => {
                    if(!player) return;
                    const t = User.get(player.id)
                    if(t) t.notify('Unentschieden, überfahren', 'error');
                    if(player.stage !== 'ok') return;
                    if(player.score === res[0].score) player.stage = 'ready';
                    player.score = 0;
                    player.scoreArr = [];
                })
                if(data.croupier){
                    const t = User.get(data.croupier)
                    if(t) t.notify('Unentschieden, überfahren', 'error');
                }
                tables.set(id, data)
                updateTableData(id);
                await system.sleep(1000)
            }
        }
    }
    check(id);
    updateTableData(id);
    await system.sleep(5000)

    check(id);
    data = tables.get(id);
    data.stage = 'ok';
    let res: { id: number, score: number }[] = [];
    data.players.map(player => {
        if (!player) return;
        if (player.stage !== 'ok') return;
        if (!player.score) return;
        res.push({id: player.id, score: player.score})
    })
    res = system.sortArrayObjects(res, [{"id": 'score', type: 'DESC'}]);
    const toDealer = (data.betsum / 100) * (typeof DICE_TABLES_LIST[id].npc === 'number' ? DICE_TABLE_SETTINGS.DEALER_PERCENT.NPC : DICE_TABLE_SETTINGS.DEALER_PERCENT.PLAYER)
    if (res.length > 0) {
        let player = User.get(res[0].id);
        if (player) {
            player.user.addChips(data.betsum - toDealer, false, `Der Sieg in den Knochen`);
            runCasinoAchievWin(player, 'Dice', data.betsum - toDealer)
            player.user.playAnimation([[`anim_casino_b@amb@casino@games@threecardpoker@ped_${player.user.feemale ? 'fe' : ''}male@regular@01a@play@v02`, 'reaction_good_var01']], true)
            data.players.map(q => {
                if (!q) return;
                const target = User.get(q.id);
                if(target) CustomEvent.triggerCef(target, 'casino:dice:win', data.betsum - toDealer, player.user.name, target.id === player.id);
            })
        }
        if (typeof DICE_TABLES_LIST[id].npc !== 'number' && data.croupier) {
            const targetCr = User.get(data.croupier);
            const toDealerGiveSum = ((toDealer / 100) * DICE_TABLE_SETTINGS.DEALER_PERCENT.TOPLAYER)
            runCasinoAchievWin(targetCr, 'DiceDealer', toDealerGiveSum)
            targetCr.user.addChips(toDealerGiveSum, false, 'Die Provision eines Croupiers beim Craps');
            CustomEvent.triggerCef(targetCr, 'casino:dice:crRew', ((toDealer / 100) * DICE_TABLE_SETTINGS.DEALER_PERCENT.TOPLAYER))
            if(player) CustomEvent.triggerCef(targetCr, 'casino:dice:win', data.betsum - toDealer, player.user.name);
        }
    }
    autoStart(id);
}

CustomEvent.registerCef('casino:dice:setBet', (player, table: number, bet: number) => {
    check(table);
    const data = tables.get(table);
    if (!data) return;
    if (data.stage !== "wait") return player.notify('Das Spiel wurde bereits veröffentlicht', 'error');
    if (data.players.find(q => q && q.stage !== 'wait')) return player.notify('Du kannst eine Wette erst ändern, wenn einer der Spieler sie bereits abgegeben hat', 'error')
    data.bet = bet;
    tables.set(table, data);
    updateTableData(table);
    return
})
CustomEvent.registerClient('casino:dice:exittable', (player, table: number) => {
    check(table);
    betCancel(player, table, true);
    const cfg = DICE_TABLES_LIST[table];
    if (!cfg) return;
    let data = tables.get(table);
    if (!data) return;
    let players: any = [];
    data.players.map((t, s) => {
        if (t && t.id === player.dbid) players.push(null);
        else players.push(t)
    })
    if (data.croupier === player.dbid) {
        data.croupier = null;
        if(data.stage === 'wait' && !data.players.find(q => q && q.stage === 'ready')) data.bet = 0;
    }
    tables.set(table, {...data, players});
    updateTableData(table);
    return
})

const check = (table: number) => {
    const data = tables.get(table);
    if (!data) return;
    let players: [DicePlayer, DicePlayer, DicePlayer, DicePlayer] = [] as any;
    let ids: number[] = [];
    // let fires = SocketSyncWeb.getfire(`dice_${table}`);
    let sync = false;
    data.players.map(target => {
        if (!target || !User.get(target.id)/* || !fires.find(q => q.dbid === target.id)*/) {
            players.push(null);
            if(target) sync = true;
        } else {
            players.push(target);
            ids.push(target.id)
        }
    })
    if(data.croupier){
        if(!User.get(data.croupier)) data.croupier = null;
    }
    tables.set(table, {...data, players})
    if(sync) updateTableData(table);
}