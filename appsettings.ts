import config  from '../../appsettings.json';

interface AppSettings {
    randomOrgApiKey: string,
}

export const appSettings = config as AppSettings;