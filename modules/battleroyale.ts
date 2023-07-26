import {
    BATTLEROYALE_KILL_SUM,
    BATTLEROYALE_REGISTER_POSS,
    BATTLEROYALE_SPAWN_Z,
    BATTLEROYALE_START_MIN_TEAM,
    BATTLEROYALE_START_SECONDS,
    BATTLEROYALE_VEHICLE_CHANCE,
    BATTLEROYALE_VEHICLES,
    BATTLEROYALE_WIN_SUM,
    BATTLEROYALE_ZONES,
    BattleroyaleZoneRadius,
    BRLootBoxBlips,
    BRLootBoxChance,
    BRLootBoxItemsCount,
    BRLootBoxItemsGroupResult,
    BRLootBoxModels,
    BRLootBoxName
} from "../../shared/battleroyale";
import {menu} from "./menu";
import {system} from "./system";
import {CustomEvent} from "./custom.event";
import {inventory} from "./inventory";
import {ARMOR_ITEM_ID, OWNER_TYPES} from "../../shared/inventory";
import {Vehicle} from "./vehicles";
import {colshapes} from "./checkpoints";
import {IventClass} from "./invent";
import {getAchievConfigByType} from "../../shared/achievements";
import {ItemEntity} from "./typeorm/entities/inventory";
import {dress} from "./customization";
import {ArmorNames} from "../../shared/cloth";


colshapes.new(BATTLEROYALE_REGISTER_POSS, 'Battle Royale', player => brMenu(player), {
    type: [1, 27],
    radius: 3
})

const brMenu = (player: PlayerMp) => {
    const user = player.user;
    if(!user) return;
    const m = menu.new(player, "Battle Royale");

    const br = BattleRoyale.getActive()
    if(!br){
        m.newItem({
            name: '~r~Сейчас нет активного матча'
        })
        return m.open()
    }

    if(!br.canRegister){
        m.newItem({
            name: '~r~Регистрация на текущий матч закрыта'
        })
        return m.open()
    }

    m.newItem({
        name: `~b~Начало через ${system.secondsToString(br.startTime - system.timestamp)}`
    })

    const myLobby = br.getMyTeam(player);
    if(myLobby){
        m.newItem({
            name: '~g~Вы зарегистрированы',
            more: 'Покинуть',
            desc: `Лобби ${myLobby.pass ? `с паролем ${myLobby.pass}` : 'без пароля'}`,
            onpress: () => {
                menu.accept(player).then(status => {
                    if(!status) return brMenu(player);
                    br.leavePlayer(player)
                    brMenu(player)
                })
            }
        })
    } else {
        m.newItem({
            name: 'Создать свою команду',
            type: 'list',
            list: ['С паролем', 'Без пароля'],
            onpress: (itm) => {
                if(br.isPlayerInLobby(player)) return player.notify('Вы уже в лобби', 'error');
                if(!br.canRegister) return player.notify('Регистрация закрыта', 'error');
                if(user.attachedToPlace) return player.notify('Вы не можете зарегистрироваться', 'error');
                const t = br.getTeam(user.id)
                if(t) return player.notify('У вас уже есть команда', 'error');
                br.teams.push({
                    owner: user.id,
                    ownerName: user.name,
                    pass: !itm.listSelected ? system.randomStr(4).toUpperCase() : null,
                    players: [{
                        id: user.id,
                        player,
                        kills: 0
                    }]
                })
                player.notify('Вы успешно зарегистрировали команду', 'success')
                brMenu(player)
            }
        })
    }

    m.newItem({
        name: "Список команд"
    })

    br.teams.map(team => {
        m.newItem({
            name: `Команда ${team.ownerName}`,
            more: `${team.players.length} / ${br.maxInTeam}`,
            onpress: async () => {
                if(team.pass){
                    let pass = await menu.input(player, 'Введите пароль от лобби', '')
                    if(!pass) return;
                    pass = pass.toUpperCase()
                    if(pass.toUpperCase() !== team.pass.toUpperCase()) return player.notify('Пароль команды не совпадает', 'error');
                }
                if(br.isPlayerInLobby(player)) return player.notify('Вы уже в лобби', 'error');
                if(!br.canRegister) return player.notify('Регистрация закрыта', 'error');
                const t = br.getTeam(team.owner)
                if(!t) return player.notify('Команда расспущена', 'error');
                if(t.players.length >= br.maxInTeam) return player.notify('Команда заполнена', 'error');
                t.players.push({
                    id: user.id,
                    player,
                    kills: 0
                })
                player.notify('Вы успешно вступили в команду', 'success')
                brMenu(player)
            }
        })
    })

    m.open();
}


interface BattleroyaleTeam {
    owner: number,
    ownerName: string,
    pass?: string,
    players: {
        spawn?: Vector3Mp
        id: number,
        player: PlayerMp,
        kills: number,
    }[]
}



export class BattleRoyale {
    /** Идентификатор для генерации уникального временного хранилища БР */
    static inventoryIdsTemp = 1;
    static lobbys: BattleRoyale[] = [];
    /** Индекс варианта полёта самолёта */
    // private readonly plane: number;
    private readonly configIndex: number;
    private readonly zones: { x: number; y: number, r: number }[];
    private interval: NodeJS.Timeout;
    private sendPos: NodeJS.Timeout;

    static getActive(){
        return this.lobbys.find(q => !q.ended)
    }

    static create(index?:number){
        if(this.getActive()) return null;
        new IventClass('gps', 'Новая сессия', Math.floor(BATTLEROYALE_START_SECONDS / 60), 'BattleRoyale', { x: BATTLEROYALE_REGISTER_POSS[0].x, y: BATTLEROYALE_REGISTER_POSS[0].y, z: BATTLEROYALE_REGISTER_POSS[0].z, h: 0}, null, false);
        return new BattleRoyale(typeof index === "number" ? index : system.randomArrayElementIndex(BATTLEROYALE_ZONES))
    }

    static get(id: number) {
        return this.lobbys.find(q => q.id === id);
    }

    static playerAttachedLobby(player: PlayerMp) {
        return this.lobbys.find(q => q.isPlayerInLobby(player))
    }

    static getByPlayer(player: PlayerMp) {
        return this.lobbys.find(q => q.started && !q.ended && q.isPlayerInLobby(player))
    }

    get canRegister(){
        return !this.started && !this.ended
    }

    readonly maxInTeam = 4
    readonly maxTeams = 10

    readonly id: number;
    readonly startTime: number;
    get config(){
        return BATTLEROYALE_ZONES[this.configIndex]
    }
    started = false;
    ended = false;
    finished = false;
    teams: BattleroyaleTeam[] = [];
    teams_backup: BattleroyaleTeam[] = [];

    get center(){
        return this.config.center
    }

    get allPlayers(): PlayerMp[]{
        this.check()
        return [].concat.apply([], this.teams.map(team => team.players.map(item => item.player)))
    }

    check() {
        this.teams.map((team, id) => {
            team.players.map((player, index) => {
                if (!mp.players.exists(player.player)) team.players.splice(index, 1);
            })
            if (team.players.length === 0) this.teams.splice(id, 1);
        })
    }


    isPlayerInLobby(player: PlayerMp) {
        this.check()
        return !!this.teams.find(team => team.players.find(item => item.id === player.dbid))
    }

    getTeam(owner: number) {
        this.check()
        return this.teams.find(q => q.owner === owner)
    }

    getMyTeam(player: PlayerMp){
        this.check()
        const team = this.teams.find(q => q.players.find(s => s.id === player.dbid));
        return team
    }

    getMyTeamId(player: PlayerMp){
        const team = this.getMyTeam(player);
        if(!team) return null;
        return team.owner
    }


    addPlayerInTeam(player: PlayerMp, owner: number) {
        this.check()
        const user = player.user;
        if (!user) return false;
        if (this.isPlayerInLobby(player)) return false;
        const team = this.getTeam(owner)
        if (!team) return false;
        team.players.push({id: user.id, kills: 0, player})
        return true;
    }

    start(){
        this.check()
        const need = mp.config.announce ? BATTLEROYALE_START_MIN_TEAM : 2
        if(this.teams.length < need){
            this.allPlayers.map(player => {
                player.notify('Количество команд недостаточно для запуска матча', 'error');
                this.leavePlayer(player)
            })
            this.started = true;
            this.ended = true;
            return;
        }
        this.teams_backup = [...this.teams]
        const playersCount = this.allPlayers.length;
        this.teams.map(team => {
            const pos = new mp.Vector3(
                system.getRandomInt(this.center.x - (this.config.radius * 0.7), this.center.x + (this.config.radius * 0.7)),
                system.getRandomInt(this.center.y - (this.config.radius * 0.7), this.center.y + (this.config.radius * 0.7)),
                BATTLEROYALE_SPAWN_Z,
            )
            team.players.map(player => {
                const user = player.player.user;
                player.spawn = new mp.Vector3(
                    system.getRandomInt(pos.x - 20, pos.x + 20),
                    system.getRandomInt(pos.y - 20, pos.y + 20),
                    BATTLEROYALE_SPAWN_Z,
                )

                user.brTeam = team.owner

                user.currentWeapon = null;
                user.teleport(player.spawn.x, player.spawn.y, player.spawn.z, 0, this.id, true);
                user.adminRestore()
                user.armour = 0;


                BattleRoyale.inventoryIdsTemp++;
                const id = BattleRoyale.inventoryIdsTemp;
                const veh = Vehicle.spawn('ruiner2', player.spawn, 0, this.id, false, true, 0);

                veh.brIndexUser = user.id

                user.hotkeys = [0, 0, 0, 0, 0]
                setTimeout(() => {
                    inventory.moveItemsOwner(OWNER_TYPES.PLAYER, user.id, OWNER_TYPES.PLAYER_TEMP, user.id)
                }, 1000)

                setTimeout(() => {
                    CustomEvent.triggerClient(player.player, 'battleroyale:start', this.configIndex, this.zones, veh.id, playersCount, team.players.map(q => {
                        return {
                            name: q.player.user.name,
                            id: q.player.id,
                        }
                    }))
                }, 100)
            })
        })


        this.config.loots.map(loot => {
            const chance = loot.chance || BRLootBoxChance;
            const spawn = system.getRandomInt(1, 100) <= chance;
            if(spawn){
                BattleRoyale.inventoryIdsTemp++;
                const id = BattleRoyale.inventoryIdsTemp;
                const type = typeof loot.type === "number" ? loot.type : system.randomArrayElementIndex([0, 1, 2])
                const countMax = BRLootBoxItemsCount[type];
                for(let c = 1; c <= countMax; c++){
                    const itms = system.randomArrayElement(BRLootBoxItemsGroupResult)
                    itms.map(itm => {
                        const itemParams: Partial<ItemEntity> = {
                            owner_type: OWNER_TYPES.BATTLE_ROYALE,
                            owner_id: id,
                            item_id: itm.item_id,
                            count: itm.amount,
                            temp: 1
                        };

                        if (itm.item_id === ARMOR_ITEM_ID) {
                            const dressConfig = dress.data.find(dressEntity => dressEntity.name === ArmorNames.StandardArmor);
                            itemParams.count = itm.amount;
                            itemParams.serial = dressConfig.name;
                            itemParams.advancedNumber = dressConfig.id;
                        }

                        inventory.createItem(itemParams, true)
                    })
                }
                // const col = colshapes.new(new mp.Vector3(loot.x, loot.y, loot.z), BRLootBoxName[type], player => {
                //     if(this.blipsLoots.has(id)){
                //         if(mp.blips.exists(this.blipsLoots.get(id))) this.blipsLoots.get(id).destroy()
                //         this.blipsLoots.delete(id)
                //     }
                //     inventory.openInventory(player);
                // }, {
                //     dimension: this.id,
                //     radius: 3,
                //     color: [0,0,0,0]
                // })
                const obj = mp.objects.new(BRLootBoxModels[type], new mp.Vector3(loot.x, loot.y, loot.z), {
                    dimension: this.id,
                    rotation: new mp.Vector3(0,0, loot.h)
                })
                this.objectsLootsPos.set(id, new mp.Vector3(loot.x, loot.y, loot.z))
                // this.colshapesLoots.set(id, col)
                this.objectsLoots.set(id, obj)
                this.blipsLoots.set(id, system.createBlip(BRLootBoxBlips[type], 74, new mp.Vector3(loot.x, loot.y, loot.z), BRLootBoxName[type], this.id))
            }
        })

        this.config.cars.map((pos, ids) => {
            if(system.getRandomInt(1, 100) <= BATTLEROYALE_VEHICLE_CHANCE) {
                const veh = Vehicle.spawn(system.randomArrayElement(BATTLEROYALE_VEHICLES), new mp.Vector3(pos.x, pos.y, pos.z), pos.h, this.id, true, false);
                BattleRoyale.inventoryIdsTemp++;
                const id = BattleRoyale.inventoryIdsTemp;
                veh.brIndex = id
                this.blipsCars.set(id, system.createBlip(225, 73, new mp.Vector3(pos.x, pos.y, pos.z), 'Транспорт', this.id))
            }
        })


        this.started = true;
        if(this.teams.length < 2) return;

        this.sendPos = setInterval(() => {
            this.check()
            this.teams.map(team => {
                const pos = team.players.map(q => {
                    return [q.player.id, Math.floor(q.player.position.x), Math.floor(q.player.position.y), Math.floor(q.player.position.z), q.player.user.health, q.player.armour, !!q.player.vehicle];
                })
                const data = JSON.stringify(pos)
                team.players.map(q => {
                    CustomEvent.triggerClientSocket(q.player, 'team:position', data)
                })
            })
        }, 500);

        this.interval = setInterval(() => {
            this.check()
            if(this.teams.length <= 1){
                this.ended = true;
                setTimeout(() => {
                    [...this.blipsCars, ...this.blipsLoots].map(q => q[1]).map(blip => {
                        if(blip && mp.blips.exists(blip)) blip.destroy()
                    })
                    // this.colshapesLoots.forEach(item => {
                    //     if(item) item.destroy()
                    // })
                    this.objectsLoots.forEach(item => {
                        if(item && mp.objects.exists(item)) item.destroy()
                    })
                    mp.vehicles.toArray().filter(q => q.dimension === this.id).map(veh => {
                        Vehicle.destroy(veh)
                    })
                    // this.colshapesLoots = new Map();
                    this.objectsLoots = new Map();
                    this.blipsCars = new Map();
                    this.blipsLoots = new Map();
                    this.objectsLootsPos = new Map();
                }, 5000)
                clearInterval(this.interval);
                clearInterval(this.sendPos);
                this.interval = null;
                if(this.teams.length === 1){
                    const id = this.teams[0].owner
                    const name = this.teams[0].ownerName
                    let gives: number[] = []
                    this.teams_backup.find(q => q.owner === id).players.map(item => {
                        const player = item.player;
                        if(!mp.players.exists(player)) return;
                        gives.push(player.dbid)
                        const user = player.user;
                        user.addMoney(BATTLEROYALE_WIN_SUM + (BATTLEROYALE_KILL_SUM * item.kills), true, 'Награда за победу в BattleRoyale режиме')
                        user.achiev.achievTickByType("brSum", BATTLEROYALE_WIN_SUM)
                        user.achiev.achievTickByType("brCount")
                    })
                    mp.players.toArray().filter(q => q.user && q.user.exists && q.user.brTeam === id).map(player => {
                        if(gives.includes(player.dbid)) return;
                        player.user.addMoney(BATTLEROYALE_WIN_SUM, true, 'Награда за победу в BattleRoyale режиме')
                        player.user.achiev.achievTickByType("brSum", BATTLEROYALE_WIN_SUM)
                        player.user.achiev.achievTickByType("brCount")
                    })
                    mp.players.toArray().filter(q => q.user && q.user.exists).map(q => {
                        q.outputChatBox(`Winner, Winner, Chicken, Dinner! Победила команда ${name}`)
                        q.user.brTeam = null;
                    })
                }
                this.allPlayers.map(player => this.leavePlayer(player))
            }
        }, 5000)

    }

    objectsLootsPos = new Map<number, Vector3Mp>();
    objectsLoots = new Map<number, ObjectMp>();
    // colshapesLoots = new Map<number, colshapeHandle>();
    blipsLoots = new Map<number, BlipMp>();
    blipsCars = new Map<number, BlipMp>();

    leavePlayer(player: PlayerMp){        
        const user = player.user;
        if(mp.players.exists(player) && this.started){
            player.user.currentWeapon = null;
            player.armour = 0;
            const rand = system.randomArrayElement(BATTLEROYALE_REGISTER_POSS)
            user.teleport(rand.x, rand.y, rand.z, 0, 0, true);
            CustomEvent.triggerClient(player, 'battleroyale:stop')
        }
        if(this.started){
            const loot = user.dropPos
            setTimeout(() => {
                BattleRoyale.inventoryIdsTemp++;
                const id = BattleRoyale.inventoryIdsTemp;
                if(user.inventory && user.inventory.length > 0){
                    inventory.moveItemsOwner(OWNER_TYPES.PLAYER, user.id, OWNER_TYPES.BATTLE_ROYALE, id)

                    const obj = mp.objects.new(BRLootBoxModels[0], new mp.Vector3(loot.x, loot.y, loot.z), {
                        dimension: this.id,
                        rotation: new mp.Vector3(0,0, 0)
                    })

                    this.objectsLootsPos.set(id, new mp.Vector3(loot.x, loot.y, loot.z))
                    this.objectsLoots.set(id, obj)

                }
                setTimeout(() => {
                    inventory.moveItemsOwner(OWNER_TYPES.PLAYER_TEMP, user.id, OWNER_TYPES.PLAYER, user.id)
                }, 3000)
            }, 2000)

            const online = this.allPlayers.length;
            if(!mp.players.exists(player) && !this.ended){
                this.allPlayers.map(player => {
                    if(mp.players.exists(player)){
                        const team = this.getMyTeam(player);
                        if(team) CustomEvent.triggerCef(player, 'hud:pubg', team.players.find(s => s.id === player.dbid).kills, online)
                    }
                })
            }
            if (player.user.armour)
                player.user.armour = 0
        }
        const teams = [...this.teams]
        const team = teams.find(q => q.players.find(s => s.id === player.dbid))
        if(team){
            team.players.splice(team.players.findIndex(q => q.id === player.dbid), 1)
            this.teams = teams;
        }
    }

    killWrite(player: PlayerMp, targetname: string){
        let a = this.teams.find(q => q.players.find(s => s.id === player.dbid))
        let b = this.teams_backup.find(q => q.players.find(s => s.id === player.dbid))
        const q = a.players.find(s => s.id === player.dbid)
        if(q){
            q.kills++;
            CustomEvent.triggerCef(q.player, 'hud:pubg', q.kills, this.allPlayers.length)
        }
        const s = b.players.find(s => s.id === player.dbid)
        if(s){
            s.kills++;
        }
        const online = this.allPlayers.length;
        this.allPlayers.map(target => {
            CustomEvent.triggerCef(target, 'hud:pubgkill', player.user.name, targetname, online - 1)
        })
    }

    constructor(configIndex: number) {
        this.startTime = system.timestamp + (mp.config.announce ? BATTLEROYALE_START_SECONDS : 60)
        this.id = system.personalDimension;
        this.configIndex = configIndex

        let zones: {x: number, y: number, r: number}[] = [];

        let prev: {x: number, y: number, r: number} = {x: this.config.center.x, y: this.config.center.y, r: this.config.radius}
        for(let id = 0; id < 3; id++){
            const delr = BattleroyaleZoneRadius[id]

            let nextR = prev.r / delr
            let range = prev.r - (nextR * 1.5);
            let pos = {
                x: system.getRandomInt(prev.x - range, prev.x + range),
                y: system.getRandomInt(prev.y - range, prev.y + range),
                r: nextR
            }
            zones.push(pos)
            prev = pos;
        }


        this.zones = [...zones]
        BattleRoyale.lobbys.push(this);
        setTimeout(() => {
            this.start()
        }, (this.startTime - system.timestamp) * 1000)
    }
}
CustomEvent.registerClient('battleroyale:gps', (player, position: {x: number, y: number, z: number}) => {
    const user = player.user;
    if(!user) return;
    const br = BattleRoyale.getByPlayer(player);
    if(!br) return;
    br.check()
    const team = br.getMyTeam(player);
    if(!team) return;

    const index = br.teams_backup.find(q => q.owner == team.owner).players.findIndex(q => q.id === player.dbid)

    team.players.map(item => {
        if(item.id !== player.dbid) CustomEvent.triggerClient(item.player, 'battleroyale:gps', position, player.dbid, index, user.name)
    })
})


mp.events.add('playerDeath', (player, reason?: number, killer?: PlayerMp) => {
    const user = player.user;
    if(!user) return;
    if(!player.dimension) return;
    const br = BattleRoyale.getByPlayer(player);
    if(!br) return;
    if(killer && br.isPlayerInLobby(killer)){
        const killeruser = killer.user;
        if(killeruser) br.killWrite(killer, user.name)
    }
    setTimeout(() => {
        if(mp.players.exists(player)) br.leavePlayer(player);
    }, 1000)
})

mp.events.add('playerQuit', (player) => {
    const user = player.user;
    if(!user) return;
    if(!player.dimension) return;
    const br = BattleRoyale.getByPlayer(player);
    if(!br) return;
    br.leavePlayer(player)
})


CustomEvent.registerClient('battleroyale:onground', (player, vehid: number) => {
    const veh = mp.vehicles.at(vehid);
    if(!veh) return;
    if(veh.brIndexUser !== player.dbid) return;
    Vehicle.destroy(veh);
})

mp.events.add('playerStartEnterVehicle', (player: PlayerMp, vehicle: VehicleMp) => {
    const user = player.user;
    if(!user) return;
    if(!vehicle.brIndex) return;
    const br = BattleRoyale.getByPlayer(player);
    if(!br) return;
    const blip = br.blipsCars.get(vehicle.brIndex);
    if(blip && mp.blips.exists(blip)) blip.destroy()
    br.blipsCars.delete(vehicle.brIndex)
    vehicle.brIndex = null;
})