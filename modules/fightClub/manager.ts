import { Fight, FightStage } from './fight'
import { ScaleformTextMp } from '../scaleform.mp'
import { FIGHT_CLUB_NPC_POS, FIGHT_CLUB_SCALEFORM_POS } from '../../../shared/fightClub'
import { business } from '../business'
import { colshapes } from '../checkpoints'
import { openFightClubMenu } from './menu'
import { systemUtil } from '../../../shared/system'
import { ratingManager } from './rating'
import {fractionCfg} from "../fractions/main";

export class FightClubManager {
    public fights: Array<Fight> = []
    public mafiaOwner: number
    
    private _scaleform: ScaleformTextMp
    
    constructor() {
        // Сортируем по кол-ву завоеванных бизнесов и выбираем сильнейшую мафию
        this.mafiaOwner = fractionCfg.list.filter(q => q.mafia).sort((a, b) => {
            return business.data.filter(q => q.mafiaOwner == a.id).length - business.data.filter(q => q.mafiaOwner == b.id).length
        })[0]?.id ?? 23
        
        this._scaleform = new ScaleformTextMp(
            systemUtil.getVector3Mp(FIGHT_CLUB_SCALEFORM_POS), 
            `Боев в очереди нет`, 
        {
                    dimension: 0,
                    type: 'front',
                    range: 5,
               }
            );
        
        colshapes.new(systemUtil.getVector3Mp(FIGHT_CLUB_NPC_POS), 'Бойцовский клуб', openFightClubMenu)
    }
    
    public addPlayerToQueue(player: PlayerMp): void {
        if (this.getPlayerFight(player))
            return this.notify(player,  'Регистрация на бой', 'Вы уже участвуете в бою')

        if (player.user.level < 2)
            return this.notify(player,  'Регистрация на бой', 'Участвовать в боях можно только со второго уровня')
        
        const freeFight = this.getFreeFight()
        if (freeFight) {
            freeFight.addOpponent(player)
            
            if (!this.fights.find(f => f.isFighting)) {
                this.startNextFight()
            }
        }
        else this.fights.push(new Fight(player))
    }

    /** Найти свободный бой
     * @return null если некуда добавить игрока
     * */
    private getFreeFight(): Fight {
        return this.fights.find(f => !f.player2)
    }

    public getPlayerFight(player: PlayerMp): Fight {
        return this.fights.find(f => f.player1 == player || f.player2 == player)
    }
    
    /**
     * Запускает подготовку к следующему бою
     */
    public startNextFight(): Fight {
        const fight = this.fights[0]
        
        if (!fight) return
        
        fight.startPreparation()
        this.updateScaleformText()
        
        ratingManager.update()
    }
    
    private updateScaleformText(): void {
        if (!this.fights.length)
            this._scaleform.text = 'Боев в очереди нет'
            
        else if (this.fights[0].isFighting) {
            this._scaleform.text = `
            ${this.fights[0].player1.user.name} (${this.fights[0].player1.user.entity.stats.fightClubWins ?? 0} / ${this.fights[0].player1.user.entity.stats.fightClubLoses ?? 0})\n
            VS 
            ${this.fights[0].player2.user.name} (${this.fights[0].player2.user.entity.stats.fightClubWins ?? 0} / ${this.fights[0].player2.user.entity.stats.fightClubLoses ?? 0})\n `
        } else if (this.fights[0].currentStage === FightStage.Preparation) {
            this._scaleform.text = `Следующий бой\n
            ${this.fights[0].player1.user.name} (${this.fights[0].player1.user.entity.stats.fightClubWins ?? 0} / ${this.fights[0].player1.user.entity.stats.fightClubLoses ?? 0})\n
            VS 
            ${this.fights[0].player2.user.name} (${this.fights[0].player2.user.entity.stats.fightClubWins ?? 0} / ${this.fights[0].player2.user.entity.stats.fightClubLoses ?? 0})\n `
        } else {
            this._scaleform.text = 'Боев в очереди нет'
        }
    }
    
    public notify(player: PlayerMp, title: string, message: string): void {
        player.notifyWithPicture(title, 'Бойцовский клуб', message, 'CHAR_ARTHUR')
    }
    
    public onPlayerKilled(victim: PlayerMp): void {
        const fightWhereKilled = this.fights.filter(f => f.isFighting)
            .find(f => f.player1 == victim || f.player2 == victim)
        
        if (fightWhereKilled) {
            fightWhereKilled.onPlayerKilled(victim)
            this.fights.shift()
            this.startNextFight()
        }
    }
    
    public onPlayerLeave(player: PlayerMp): void {
        const fight = this.getPlayerFight(player)
        if (fight) fight.onPlayerLeave(player)
    }
}

export const fightClubManager = new FightClubManager() 