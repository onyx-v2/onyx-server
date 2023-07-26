import {system} from "./system";
import {appSettings} from "../appsettings";
import fetch from 'node-fetch';

/**
 * {@link https://en.wikipedia.org/wiki/Significant_figures}
 * Range [1, 14]
 */
const GENERATED_DECIMAL_PLACES = 8;
const GENERATE_COUNT_PER_REQUEST = 500;
const API_URL = 'https://api.random.org/json-rpc/4/invoke';

interface RequestBody {
    jsonrpc: string,
    method: string,
    params: RequestParams,
    id: number
}

interface RequestParams {
    /**
     * Your API key, which is used to track the true random bit usage for your client
     */
    apiKey: string,
    /**
     * How many random decimal fractions you need. Must be within the [1, 10000] range
     */
    n: number,
    /**
     * The number of decimal places to use. Must be within the [1, 14] range
     */
    decimalPlaces: number,
    /**
     * Specifies whether the random numbers should be picked with replacement
     * @default true
     */
    replacement?: boolean
}

interface ResponseBody {
    jsonrpc: string,
    id: number,
    result?: ResponseResult,
    error?: ResponseError,
}

interface ResponseResult {
    random: Random,
    bitsUsed: number,
    bitsLeft: number,
    requestsLeft: number,
    advisoryDelay: number
}

interface Random {
    data: number[],
    completionTime: string,
}

interface ResponseError {
    code: number,
    message: string,
    data: any
}

/**
 * Загруженный с random.org пул случайных чисел
 */
const valuesPool: number[] = [];
let isValuesLoadingNow = false;

async function loadValues () {
    if (isValuesLoadingNow) {
        return;
    }

    isValuesLoadingNow = true;

    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(getRequestBody()),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const responseBody: ResponseBody = await response.json()
    if (responseBody.error) {
        system.debug.error(`Error occurred on fetching random.org api: ` +
            `${responseBody.error.code}, ${responseBody.error.message}, ${responseBody.error.data}`);

        return;
    }

    const generatedNumbers = responseBody.result.random.data;
    generatedNumbers.forEach(number => valuesPool.push(number));

    system.debug.success(`Random.org api pool updated with ${generatedNumbers.length} numbers`);
    isValuesLoadingNow = false;
}

function getRequestBody(): RequestBody {
    return {
        jsonrpc: '2.0',
        method: 'generateDecimalFractions',
        params: {
            apiKey: appSettings.randomOrgApiKey,
            n: GENERATE_COUNT_PER_REQUEST,
            decimalPlaces: GENERATED_DECIMAL_PLACES
        },
        id: getRequestId()
    };
}

function getRequestId() {
    return 1;
}

export const randomOrgApi = {
    /**
     * Возвращает случайное число, сгенерированное random.org
     */
    get: function (): number {
        if (valuesPool.length < 10) {
            loadValues();
        }

        if (valuesPool.length === 0) {
            return Math.random();
        }

        return valuesPool.shift();
    }
}
