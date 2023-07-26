import { fightClubManager } from './manager'
import {
    FIGHT_CLUB_FIGHT1_POS,
    FIGHT_CLUB_FIGHT2_POS, FIGHT_CLUB_NPC_POS,
    FIGHT_CLUB_WINNER_FROM_BETS_PERCENT,
    FIGHT_PREPARE_TIME_IN_MIN
} from '../../../shared/fightClub'
import { FightBet } from './bets/fightBet'
import { BetType } from './bets/betType'
import { inventory } from '../inventory'
import { OWNER_TYPES } from '../../../shared/inventory'
import { CustomEvent } from '../custom.event'

export enum FightStage {
    Waiting,
    Preparation,
    Fighting
}

export class Fight {
    private _player2: PlayerMp
    private _player1: PlayerMp
    private _preparationInterval: number
    public betting: FightBet
    
    public get player2(): PlayerMp {
        return this._player2
    }
    public get player1(): PlayerMp {
        return this._player1
    }
    public currentStage: FightStage
    public get isFighting(): boolean {
        return this.currentStage == FightStage.Fighting
    }
    
    constructor(player1: PlayerMp) {
        this._player1 = player1
        this.currentStage = FightStage.Waiting
        this.betting = new FightBet(this)
        fightClubManager.notify(this.player1, 'Регистрация на бой', `Вы зарегистрировались на бой. Ожидайте соперника`)
    }
    
    public addOpponent(player2: PlayerMp): void {
        this._player2 = player2
        fightClubManager.notify(this.player1, 'Регистрация на бой', `Вы будете драться против ${player2.user.name}`)
        fightClubManager.notify(this.player2, 'Регистрация на бой', `Вы будете драться против ${this.player1.user.name}`)
    }
    
    private startFight(): void {
        if (!this.player1?.user || !this.player2?.user) {
            this.removeFromQueue()
            return
        }
        this.currentStage = FightStage.Fighting
        this.player1.user.teleport(FIGHT_CLUB_FIGHT1_POS.x, FIGHT_CLUB_FIGHT1_POS.y, FIGHT_CLUB_FIGHT1_POS.z)
        this.player2.user.teleport(FIGHT_CLUB_FIGHT2_POS.x, FIGHT_CLUB_FIGHT2_POS.y, FIGHT_CLUB_FIGHT2_POS.z)
        
        this.player1.user.removeCurrentWeapon()
        this.player2.user.removeCurrentWeapon()
        
        Fight.giveTempInventory(this.player1)
        Fight.giveTempInventory(this.player2)

        CustomEvent.triggerClient(this.player1, 'fightClub:startFight')
        CustomEvent.triggerClient(this.player2, 'fightClub:startFight')
    }
    
    private static giveTempInventory(player: PlayerMp): void {
        if (player.user && player.user.inventory && player.user.inventory.length > 0) {
            inventory.moveItemsOwner(OWNER_TYPES.PLAYER, player.user.id, OWNER_TYPES.PLAYER_TEMP, player.user.id)
        }
    }
    
    private static resetTempInventory(player: PlayerMp): void {
        if (player.user)
            inventory.moveItemsOwner(OWNER_TYPES.PLAYER_TEMP, player.user.id, OWNER_TYPES.PLAYER, player.user.id)
    }
    
    public startPreparation(): void {
        this.currentStage = FightStage.Preparation
        this._preparationInterval = setTimeout(() => this.startFight(), FIGHT_PREPARE_TIME_IN_MIN * 1000 * 60)
        
        CustomEvent.triggerClient(this.player1, 'fightClub:startPreparation', this.player2.user.name)
        CustomEvent.triggerClient(this.player2, 'fightClub:startPreparation', this.player1.user.name)
    }
    
    public stopPreparation(): void {
        fightClubManager.notify(this.player1, 'Бой', `Ваш оппонент вышел из игры. Ваш бой теперь в конце очереди`)
        fightClubManager.addPlayerToQueue(this.player1)
        
        clearTimeout(this._preparationInterval)
        
        if (this.player1) CustomEvent.triggerClient(this.player1, 'fightClub:stopPreparation')
        if (this.player2) CustomEvent.triggerClient(this.player2, 'fightClub:stopPreparation')
        
        this.removeFromQueue()
    }
    
    public removeFromQueue(): void {
        const idx = fightClubManager.fights.indexOf(this)
        fightClubManager.fights.splice(idx, 1)
        
        if (idx === 0) 
            fightClubManager.startNextFight()
    }
    
    private stop(loser: PlayerMp): void {
        const winner = loser == this.player1 ? this.player2 : this.player1
        
        Fight.resetTempInventory(this.player1)
        Fight.resetTempInventory(this.player2)
        
        if (winner.user) {
            winner.user.entity.stats = {...winner.user.entity.stats, fightClubWins: !winner.user.entity.stats.fightClubWins ? 1 : winner.user.entity.stats.fightClubWins + 1 }
            const moneyForWin = Math.floor(this.betting.getTotalAmountByType(winner == this.player1 ? BetType.Win1 : BetType.Win2) * FIGHT_CLUB_WINNER_FROM_BETS_PERCENT / 100)
            winner.user.addMoney(
                moneyForWin,
                false,
                `Заработал за победу в бою против ${loser?.user?.name}`
            )
            fightClubManager.notify(winner, 'Бой', `Вы победили в бою и заработали ${moneyForWin}$`)
            
            winner.user.teleport(FIGHT_CLUB_NPC_POS.x, FIGHT_CLUB_NPC_POS.y, FIGHT_CLUB_NPC_POS.z, 0, 0, true)
            CustomEvent.triggerClient(winner, 'fightClub:stopFight')
        }
        
        if (loser?.user) {
            loser.user.entity.stats = {...loser.user.entity.stats, fightClubLoses: !loser.user.entity.stats.fightClubLoses ? 1 : loser.user.entity.stats.fightClubLoses + 1 }
            fightClubManager.notify(loser, 'Бой', `Вы проиграли бой`)

            loser.user.teleport(FIGHT_CLUB_NPC_POS.x, FIGHT_CLUB_NPC_POS.y, FIGHT_CLUB_NPC_POS.z, 0, 0, true)
            CustomEvent.triggerClient(loser, 'fightClub:stopFight')
        }
        
        this.betting.onFightEnded(winner == this.player1 ? BetType.Win1 : BetType.Win2)
    }
    
    public onPlayerKilled(victim: PlayerMp): void {
        this.stop(victim)
    }
    
    public onPlayerLeave(leavePlayer: PlayerMp): void {
        if (this.isFighting) {
            this.stop(leavePlayer)
            leavePlayer.user.entity.position = JSON.stringify({x: FIGHT_CLUB_NPC_POS.x, y: FIGHT_CLUB_NPC_POS.y, z: FIGHT_CLUB_NPC_POS.z, h: 0, d: 0})
        } else {
            if (this._player1 == leavePlayer) {
                if (this.player2)
                    this._player1 = this.player2
                else this.removeFromQueue()
            }
            this._player2 = null
            if (this.currentStage === FightStage.Preparation) this.stopPreparation()
        }
    }
}