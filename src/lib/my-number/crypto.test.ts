import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {encryptMyNumber,decryptMyNumber,encryptOnboardingNumbers} from './crypto.mjs';
import {validMyNumber} from './validation';
beforeEach(()=>vi.stubEnv('MY_NUMBER_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64')));
afterEach(()=>vi.unstubAllEnvs());
it('毎回異なる暗号文になり、復号すると元に戻る',()=>{
 const a=encryptMyNumber('123456789018'),b=encryptMyNumber('123456789018');
 expect(a.my_number_cipher).not.toBe(b.my_number_cipher);
 expect(decryptMyNumber(a)).toBe('123456789018');expect(a.my_number_last4).toBe('9018');
 expect(JSON.stringify(a)).not.toContain('123456789018');
});
it('鍵違い・改ざん・鍵未設定は失敗する',()=>{
 const value=encryptMyNumber('123456789018');
 vi.stubEnv('MY_NUMBER_ENCRYPTION_KEY',Buffer.alloc(32,2).toString('base64'));
 expect(()=>decryptMyNumber(value)).toThrow();
 vi.stubEnv('MY_NUMBER_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));
 expect(()=>decryptMyNumber({...value,my_number_tag:Buffer.alloc(16).toString('base64')})).toThrow();
 vi.stubEnv('MY_NUMBER_ENCRYPTION_KEY','');expect(()=>encryptMyNumber('123456789018')).toThrow();
});
it('入社手続きの本人と扶養家族は暗号化し、伏せ字の再保存は暗号文を保持する',()=>{
 const row=encryptOnboardingNumbers({my_number:'123456789018',dependents:[{name:'家族',my_number:'123456789018'}]});
 expect(JSON.stringify(row)).not.toContain('123456789018');
 expect(decryptMyNumber(row.my_number_secret)).toBe('123456789018');
 const saved=encryptOnboardingNumbers({my_number:row.my_number,dependents:[{name:'家族',my_number:row.dependents[0].my_number}]},row);
 expect(saved).toEqual(row);
});
it('桁数・数字以外・検査用の数字を確認する',()=>{
 expect(validMyNumber('123456789018')).toBe(true);
 for(const value of ['123456789012','123','１２３４５６７８９０１８','12345678901x'])expect(validMyNumber(value)).toBe(false);
});
