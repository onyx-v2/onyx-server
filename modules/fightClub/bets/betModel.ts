import { BetType } from './betType'

export class BetModel {
    private readonly _player: PlayerMp
    private readonly _amount: number
    private readonly _betType: BetType

    public get amount(): number {
        return this._amount
    }

    public get type(): BetType {
        return this._betType
    }

    public get player(): PlayerMp {
        return this._player
    }
    
    constructor(player: PlayerMp, amount: number, betType: BetType) {
        this._player = player
        this._amount = amount
        this._betType = betType
    }
}