import { Fight } from '../fight'
import { FIGHT_CLUB_MAX_BET_AMOUNT } from '../../../../shared/fightClub'
import { fightClubManager } from '../manager'
import { BetType } from './betType'
import { BetModel } from './betModel'

export class FightBet {
    private _fight: Fight
    private _bets: BetModel[] = []

    public get totalBetsAmount(): number {
        return this._bets
            .map(b => b.amount)
            .reduce((prev: number, next: number) => prev + next, 0)
    }
    
    constructor(fight: Fight) {
        this._fight = fight
    }
    
    /**
     * Метод возвращает количество денег поставленных на тип ставки
     * @param type - указанный тип ставки
     */
    public getTotalAmountByType(type: BetType): number {
        return this._bets
            .filter(b => b.type === type)
            .map(b => b.amount)
            .reduce((prev: number, next: number) => prev + next, 0)
    }
    
    public addBet(player: PlayerMp, amount: number, type: BetType): void {
        if (!this.isAmountCorrect(amount))
            return fightClubManager.notify(player, 'Ставка', `Ставка должна быть от 0 до ${FIGHT_CLUB_MAX_BET_AMOUNT}`)

        if (this._fight.player1 == player || this._fight.player2 == player)
            return fightClubManager.notify(player, 'Ставка', 'Вы не можете ставить на бой с своим участием')

        if (this._bets.find(b => b.player == player))
            return fightClubManager.notify(player, 'Ставка', 'Вы не можете делать больше одной ставки на бой')
        
        if (player.user.money < amount)
            return fightClubManager.notify(player, 'Ставка', 'У вас недостаточно средств')
        
        player.user.removeMoney(amount, false, `Ставка на ${type}`)
        this._bets.push(new BetModel(player, amount, type))
    }
    
    public onFightEnded(winnerBetType: BetType): void {
        const amountToPay = this.totalBetsAmount * 0.7
        const payToOnePlayer = amountToPay / this._bets.filter(b => b.player.user && b.type === winnerBetType).length ?? 1
        
        if (this._bets.length === 1) 
            this._bets[0].player.user?.addMoney(10000, false, 'Выиграл ставку в БК')
        else this._bets.forEach(bet => {
            if (mp.players.exists(bet.player) && bet.player.user && bet.type === winnerBetType) {
                bet.player.user.addMoney(payToOnePlayer, false, 'Выиграл ставку в БК')
            }
        })
    }
    
    private isAmountCorrect(amount: number): boolean {
        return !(isNaN(amount) || amount <= 0 || amount > FIGHT_CLUB_MAX_BET_AMOUNT)
    }
}