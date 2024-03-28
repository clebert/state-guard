import { createConfigs } from 'onecfg-lib-eslint';

export default [{ ignores: [`lib/`] }, ...createConfigs({ browser: true })];
