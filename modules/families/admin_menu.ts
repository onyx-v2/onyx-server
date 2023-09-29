import {menu} from "../menu";
import {giveFamilyQuestCargo, registerFamilyCargoVehicle} from "./quests";
import {familyCreateGUI} from "./create";
import {CargoBattleFamilyQuest} from "./quests/cargobattle";
import {Family} from "./family";
import {Vehicle} from "../vehicles";
import {DONATE_MONEY_NAMES} from "../../../shared/economy";
import {system} from "../system";
import {parking} from "../businesses/parking";
import {CONTRACT_NUM_FOR_FAMILY, FamilyReputationType} from "../../../shared/family";
import {writeSpecialLog} from "../specialLogs";


export const showFamilyAdminMenu = (player:PlayerMp) => {
    const m = menu.new(player, 'Familiensystem');
    m.newItem(
        {
            name: 'Wähle ein Fahrzeug für die Ladung (falls verfügbar)',
            onpress: () => registerFamilyCargoVehicle(player)
        },
        {
            name: 'Nimm die Sendung persönlich in Empfang (wenn möglich)',
            onpress: () => giveFamilyQuestCargo(player)
        },
        {
            name: 'Familie erstellen GUI',
            onpress: () => familyCreateGUI(player)
        },
        {
            name: 'Gezwungen, den Kampf um die Ladung aufzunehmen',
            onpress: () => new CargoBattleFamilyQuest().start()
        },
        {
            name: 'Gezwungen, mit den Vorbereitungen für die Ardennenoffensive zu beginnen',
            onpress: () => new CargoBattleFamilyQuest().startReady(true).then(res => {
                player.notify('Gestartet')
            }).catch(error => {
                player.notify('Start fehlgeschlagen: '+error)
            })
        },
        {
            name: 'Alle Frachtkämpfe gewaltsam beenden',
            onpress: () => {
                CargoBattleFamilyQuest.stopAll()
                player.notify('Erledigt')
            }
        },
        {
            name: 'Verändere deine Familie',
            onpress: () => {
                let list:string[] = ['Verlassen der Familie']
                Family.getAll().map(f => list.push(f.name))
                menu.selector(player, 'Wähle eine Familie', list, true).then(id => {
                    if(!id) {
                        if(player.user.family) {
                            player.user.family = null
                            player.notify('Du hast deine Familie verlassen')
                        }
                        return;
                    }
                    if(!Family.getAll()[id-1]) return;
                    player.notify('Du hast deine Familie verändert: '+Family.getAll()[id-1].name)
                    player.user.family = Family.getAll()[id-1]
                    player.user.familyRank = player.user.family.leaderRankID
                })
            }
        },
        {
            name: 'Ändere deinen Rang in der Familie (wenn möglich)',
            onpress: () => {
                if(!player.user || !player.user.family) return;
                menu.selector(player, 'Wähle einen Rang', player.user.family.ranks.map(r => {
                    return r.name
                }), false).then(name => {
                    player.user.family.ranks.find(r => r.name == name)
                    player.user.familyRank = player.user.family.ranks.find(r => r.name == name).id || 1
                    player.notify(`Du hast deinen Rang in der Familie geändert: ${player.user.family.getRank(player.user.familyRank).name}`)
                })
            }
        },
        {
            name: 'Informationen über deine Familie ansehen/ändern',
            onpress: () => {
                if(!player.user || !player.user.family) return;
                showFamilyEditAdminMenu(player, player.user.family)
            }
        }
    )
    m.open()
}


export const showFamilyEditAdminMenu = (player:PlayerMp, family:Family) => {
    return new Promise<void>(async () => {
        if(!family && !family.id) return;
        if(!player.user || !player.user.hasPermission('admin:familyControl')) return;

        const allMembers = await family.getAllMembers()
        const membersOnline = allMembers.filter(u => u.is_online)

        const m = menu.new(player, 'Familiensystem');
        m.newItem(
            {
                name: 'Familien-ID',
                more: family.id
            },
            {
                name: 'Anzahl der Familienmitglieder',
                more: `Gesamt: ${allMembers.length}`,
                desc: `Online: ${membersOnline.length}`
            },
            {
                name: 'Titel',
                more: family.name,
                onpress: () => menu.input(player, 'Einen neuen Namen eingeben', family.name, 24).then(newName => {
                    if(newName.length < 3) player.notify('Der Name muss mindestens 3 Zeichen enthalten')
                    if (!newName || ! /^[a-zA-Z_-]{0,15}$/i.test(newName)) {
                        player.notify('Der Name enthält unnötige Zeichen', "error")
                    }
                    else if (Family.getAll().find(f => f.name == newName)) {
                        player.notify('Es gibt bereits eine Familie mit diesem Namen', "error")
                        return false;
                    }
                    else family.name = newName
                    showFamilyEditAdminMenu(player, family)
                })
            },
            {
                name: 'Anzahl der Punkte',
                more: family.points,
                onpress: () => menu.input(player, 'Gib die Anzahl der Punkte ein', family.points, 20, 'int').then(newVal => {
                    if(isNaN(newVal) || newVal < 0) player.notify('Die Menge kann nicht kleiner als 0 sein')
                    else family.points = newVal
                    player.user.log('AdminJob', `Die Anzahl der Punkte festlegen ${family.seasonPoints} Familie ${family.name}`, family.id)
                    showFamilyEditAdminMenu(player, family)
                })
            },
            {
                name: 'Anzahl der Punkte in der Saison',
                more: family.seasonPoints,
                onpress: () => menu.input(player, 'Gib die Anzahl der Punkte ein', family.seasonPoints, 20, 'int').then(newVal => {
                    if(isNaN(newVal) || newVal < 0) player.notify('Die Menge kann nicht kleiner als 0 sein')
                    else family.seasonPoints = newVal
                    player.user.log('AdminJob', `Lege die Anzahl der Saisonpunkte fest ${family.seasonPoints} Familie ${family.name}`, family.id)
                    showFamilyEditAdminMenu(player, family)
                })
            },
            {
                name: 'Menge der Fracht',
                more: family.cargo,
                onpress: () => menu.input(player, 'Gib die Menge der Ladung ein', family.cargo, 20, 'int').then(newVal => {
                    const lastValue = family.cargo;
                    if(isNaN(newVal) || newVal < 0) player.notify('Die Menge kann nicht kleiner als 0 sein')
                    else family.cargo = newVal
                    writeSpecialLog(`Änderte die Menge der Fracht von ${lastValue} auf ${newVal} | ${family.name}`, player, 0);
                    showFamilyEditAdminMenu(player, family)
                })
            },
            {
                name: 'Familienebene',
                more: family.level,
                onpress: () => menu.input(player, 'Gib die Familienebene ein', family.level, 20, 'int').then(newVal => {
                    const lastValue = family.level;
                    if(isNaN(newVal) || newVal < 0) player.notify('Die Menge kann nicht kleiner als 0 sein')
                    else family.level = newVal
                    writeSpecialLog(`Änderte die Ebene der Familie von ${lastValue} auf ${newVal} | ${family.name}`, player, 0);
                    showFamilyEditAdminMenu(player, family)
                })
            },
            {
                name: 'Wettbewerb gewinnt',
                more: family.wins,
                onpress: () => menu.input(player, 'Gib die Anzahl der Wettbewerbsgewinne ein', family.wins, 20, 'int').then(newVal => {
                    if(isNaN(newVal) || newVal < 0) player.notify('Die Menge kann nicht kleiner als 0 sein')
                    else family.wins = newVal
                    showFamilyEditAdminMenu(player, family)
                })
            },
            // {
            //     name: '~r~Сброс сезонных очков',
            //     onpress: () => {
            //         menu.accept(player).then(status => {
            //             if(!status) return;
            //             family.clearSeasonPoints(true)
            //             player.notify('Готово', 'success');
            //         })
            //     }
            // }

            {
                name: '~r~Ersetze verfügbare Verträge',
                onpress: () => {
                    menu.accept(player).then(status => {
                        if(!status) return;
                        family.setRandomContracts(CONTRACT_NUM_FOR_FAMILY)
                        player.notify('Erfolgreich', 'success');
                    })
                }
            }
        );
        if (player.user.hasPermission('admin:familyBank')) {
            m.newItem(
                {
                    name: 'Geldbetrag',
                    more: family.money,
                    onpress: () => menu.input(player, 'Gib den Geldbetrag ein', family.money, 20, 'int').then(newVal => {
                        const lastValue = family.money;
                        if(isNaN(newVal) || newVal < 0) player.notify('Die Menge kann nicht kleiner als 0 sein')
                        else family.money = newVal
                        writeSpecialLog(`Änderte die Höhe des Geldes der Familie von ${lastValue} auf ${newVal}  | ${family.name}`, player, 0);
                        showFamilyEditAdminMenu(player, family)
                    })
                },
                {
                    name: 'Höhe der Spende',
                    more: family.donate,
                    onpress: () => menu.input(player, 'Gib die Höhe der Spende ein', family.donate, 20, 'int').then(newVal => {
                        const lastValue = family.donate;
                        if(isNaN(newVal) || newVal < 0) player.notify('Die Menge kann nicht kleiner als 0 sein')
                        else family.donate = newVal
                        writeSpecialLog(`Änderte den Betrag der Familienspende von ${lastValue} auf ${newVal}  | ${family.name}`, player, 0);
                        showFamilyEditAdminMenu(player, family)
                    })
            })
        }
        
        m.newItem({
            name: `Haus`,
            more: !!family.house?`${family.house.name} #${family.house.id}`:`Abwesend`,
            onpress: () => {
                if(!!family.house) player.user.teleport(family.house.x, family.house.y, family.house.z, family.house.h, family.house.d)
            }
        })

        const targetVehs = Vehicle.getFamilyVehicles(family.id)
        if(!targetVehs || !targetVehs.length){
            m.newItem({
                name: "~r~Familienautos",
                more: "~r~Die Familie hat keine Autos",
            })
        } else {
            m.newItem({
                name: "Familienfahrzeuge",
                more: `x${targetVehs.length}`,
                onpress: () => {
                    let submenu = menu.new(player, "Familienfahrzeuge "+family.name);
                    submenu.onclose = () => {
                        showFamilyEditAdminMenu(player, family)
                    }
                    targetVehs.map(veh => {
                        submenu.newItem({
                            name: `#${veh.id} ${veh.name}`,
                            more: `${veh.number}`,
                            desc: `Kosten der Anschaffung: ${veh.isDonate ? DONATE_MONEY_NAMES[2] : '$'} ${system.numberFormat(veh.data.cost)}. ${veh.onParkingFine ? 'На штрафстоянке $' + system.numberFormat(veh.fine) : `На точке спавна - ${veh.inSpawnPoint ? 'Да' : 'Нет'}, Место парковки - ${parking.allVehsInAllParking().find(q => q.entity.id === veh.id) ? 'Парковка' : `Дом`}`}`,
                            onpress: () => {
                                let submenu2 = menu.new(player, "Aktionen über TC");
                                submenu.onclose = () => {
                                    showFamilyEditAdminMenu(player, family)
                                }
                                submenu2.newItem({
                                    name: "Respavn",
                                    onpress: () => {
                                        veh.respawn();
                                    }
                                })
                                submenu2.newItem({
                                    name: "Teleportiere die TK zu mir",
                                    onpress: () => {
                                        Vehicle.teleport(veh.vehicle, player.position, player.heading, player.dimension);
                                    }
                                })
                                submenu2.newItem({
                                    name: "Teleport zum TC",
                                    onpress: () => {
                                        if (veh.exists) player.user.teleport(veh.vehicle.position.x, veh.vehicle.position.y, veh.vehicle.position.z, 0, veh.vehicle.dimension)
                                    }
                                })
                                submenu2.newItem({
                                    name: "Teleportiere dich zu einem Parkplatz",
                                    onpress: () => {
                                        player.user.teleport(veh.position.x, veh.position.y, veh.position.z, veh.position.h, veh.position.d)
                                    }
                                })
                                if(player.user.isAdminNow(6)){
                                    submenu2.newItem({
                                        name: "~r~Auto löschen",
                                        onpress: () => {
                                            menu.accept(player).then(status => {
                                                if(!status) return;
                                                veh.deleteFromDatabase()
                                                showFamilyEditAdminMenu(player, family)
                                                player.notify('Es ist vollbracht', 'success');
                                            })
                                        }
                                    })
                                }
                                submenu2.open();
                            }
                        })
                    })
                    submenu.open();
                }
            })
        }


        if(player.user.family != family) {
            m.newItem({
                name: 'Вступить в семью',
                onpress: () => {
                    player.notify('Вы изменили свою семью: '+family.name)
                    player.user.family = family
                    player.user.familyRank = player.user.family.leaderRankID
                }
            })
        }
        m.open()
    })
}