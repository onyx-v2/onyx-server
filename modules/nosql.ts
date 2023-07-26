import jsonfile from 'jsonfile';
import fs from 'fs';

export class NoSQLbase<T> {
    private inited = false
    get data() {
        return this.datas
    }
    set data(val: T[]) {
        this.datas = val
        // this.save();
    }
    insert(...val: T[]) {
        this.data.push(...val);
        return this.data[this.data.length - 1]
        // this.save();
    }
    remove(val: T | number) {
        if (typeof val === "number") {
            this.data.splice(val, 1)
        } else {
            this.data.splice(this.data.indexOf(val), 1)
        }
    }
    plusMinus(value: Partial<T>, param: { where: Partial<T>, limit?: number }, plus: boolean) {
        for (let arg in value) {
            if (typeof value[arg] !== "number") {
                return console.error("Invalid argument type", arg, typeof value[arg], value[arg])
            }
        }
        let data = this.find(param);
        if (data.length == 0) return;
        data.map(itm => {
            for (let arg in value) {
                if (typeof itm[arg] === "number") {
                    if (plus) {
                        // @ts-ignore
                        itm[arg] += value[arg]
                    } else {
                        // @ts-ignore
                        itm[arg] -= value[arg]
                    }
                }
            }
        })
    }
    increment(value: Partial<T>, param: { where: Partial<T>, limit?: number }) {
        this.plusMinus(value, param, true);
    }
    decrement(value: Partial<T>, param: { where: Partial<T>, limit?: number }) {
        this.plusMinus(value, param, false);
    }
    clear() {
        this.data = [];
    }
    save() {
        if (this.file == ":memory:") return;
        jsonfile.writeFileSync('./nosql/' + this.file + '.json', this.datas)
    }
    find(param: { where: Partial<T>, limit?: number }): T[] {
        let data: T[] = [];
        if (!param.limit) param.limit = 1;
        const check: (el: T) => any = (el) => {
            let ok = true;
            for (let arg in param.where) {
                if (el[arg] != param.where[arg]) ok = false;
            }
            return ok;
        }
        return this.data.filter(itm => {
            if (data.length >= param.limit) return false;
            return check(itm);
        });
    }
    findOne(param: { where: Partial<T> }): T {
        let data = this.find({ ...param, limit: 1 })
        if (data.length > 0) return data[0];
        else undefined;
    }
    private datas: T[];
    private onInitHandler?: () => void;
    private file: string;
    constructor(file: string = ":memory:", onInitHandler?: () => void) {
        this.file = file;
        this.onInitHandler = onInitHandler;
        this.data = []
        this.init().then(() => {
            if (this.onInitHandler) {
                this.onInitHandler();
            }
        });
    }
    init(): Promise<T[]> {
        return new Promise((resolve, reject) => {
            if (this.inited) return this.data;
            if (!fs.existsSync('./nosql/')) {
                fs.mkdirSync('./nosql/');
            }
            if (this.file == ":memory:") return resolve(this.data);
            if(this.file.includes('/')){
                if(this.file.indexOf('/') === 0) this.file = this.file.replace('/', '');
                let urls:string[] = []
                this.file.split('/').map((url, index, array) => {
                    if(index === array.length - 1) return;
                    urls.push(url)
                    if (!fs.existsSync(`./nosql/${urls.join('/')}`)) {
                        fs.mkdirSync(`./nosql/${urls.join('/')}`);
                    }
                })
            }
            jsonfile.readFile('./nosql/' + this.file + '.json').then(obj => {
                this.data = obj;
                this.inited = true;
                resolve(this.data);
            }).catch(err => {
                jsonfile.writeFile('./nosql/' + this.file + '.json', [], function (err) {
                    if (err) console.error(err)
                })
                // system.debug.debug("Create new NoSQL instance " + this.file);
                this.data = [];
                this.inited = true;
                resolve(this.data);
            })
        })
    }
}
