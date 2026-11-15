const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const B = require(process.env.BABYLON_SOURCE);
const root = path.resolve(__dirname, '..');
const store = new Map();
let now = 10000000;
const app = {}, world = {track:{totalLaps:1}};
const context = vm.createContext({app,world,BABYLON:B,window:{},Date:{now:()=>now},
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});
const run = (file, init='') => vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').replaceAll('export function ','function ')+'\n'+init,context);
run('cars/catalog.js');
run('game/profile.js','installApp(app);');
run('game/missions.js','installApp(app);');
Object.assign(app,{MISSIONS_KEY:'missions',PURCHASED_CARS_KEY:'cars',OVAL_TICKETS_KEY:'tickets',COINS_STORAGE_KEY:'coins',coins:0,
  refreshMissionsPanel:()=>{},refreshMoneyLabel:()=>{},refreshAccountStats:()=>{}});
const reset = () => {store.clear();app.coins=0;app.saveMissionState({ticketMissionId:'tunnel-first'});};
const race = place => app.recordMissionRaceResult({place,trackId:'neon-circuit-1',carId:'starter'});
reset();
race(1);race(1);race(2);assert.equal(app.getMissionProgress('first-streak-5'),0);
for(let i=0;i<5;i++) race(1);
race(3);race(1);assert.equal(app.getMissionProgress('first-streak-5'),5);
assert.equal(JSON.parse(store.get('missions')).firstStreak,5);
assert(app.claimMissionReward('first-streak-5'));
assert.equal(app.coins,135);assert(!app.claimMissionReward('first-streak-5'));
now+=app.MISSION_RESET_MS+1;assert.equal(app.getMissionProgress('first-streak-5'),0);
race(1);race(2);assert.equal(app.getMissionProgress('first-streak-5'),0);

reset();
app.purchaseCar('turbocharger');assert(!app.isMissionRetired('buy-epic-2'));
app.purchaseCar('rolima');assert(app.claimMissionReward('buy-epic-2'));
now+=app.MISSION_RESET_MS+1;assert(!app.isMissionRetired('buy-epic-2'));
app.purchaseCar('tropical');assert(!app.isMissionRetired('buy-epic-2'));
app.purchaseCar('tanque');assert(!app.isMissionRetired('buy-epic-2'));
assert(app.claimMissionReward('buy-epic-2'));assert.equal(app.coins,200);
now+=app.MISSION_RESET_MS+1;
assert(app.isMissionRetired('buy-epic-2'));assert(!app.claimMissionReward('buy-epic-2'));
let saved=app.loadMissionState();saved.ticketMissionId='buy-epic-2';app.saveMissionState(saved);
assert.notEqual(app.reconcileMissionResets().ticketMissionId,'buy-epic-2');
for(let i=0;i<50;i++) assert.notEqual(app.pickRandomTicketMissionId(null),'buy-epic-2');
// Saves antigos: coleção completa com recompensa pendente ainda pode resgatar.
app.saveMissionState({ticketMissionId:'buy-epic-2',epicBaseline:2});
assert(!app.isMissionRetired('buy-epic-2'));assert(app.claimMissionReward('buy-epic-2'));
assert.equal(app.getOvalTickets(),1);assert(!app.claimMissionReward('buy-epic-2'));
now+=app.MISSION_RESET_MS+1;assert(app.isMissionRetired('buy-epic-2'));
// Ciclo antigo inviável (faltaria comprar dois, mas só resta um).
app.savePurchasedCars(['turbocharger','rolima','tropical']);
app.saveMissionState({epicBaseline:3,ticketMissionId:'buy-epic-2'});
assert(app.isMissionRetired('buy-epic-2'));
// Progresso de 1/2 + um épico restante continua viável.
app.saveMissionState({epicBaseline:2,ticketMissionId:'buy-epic-2'});
assert(!app.isMissionRetired('buy-epic-2'));

run('game/physics.js','installApp(app);installScene(app,world);initializePhysics(app);');
const stop={};app.distanceAlongPath=()=>{throw stop;};
const drive=(speed,input,dt)=>{
  const racer={speed,wallHitCooldown:0,finished:false,mesh:{position:new B.Vector3(),rotation:{x:0,y:0,z:0}}};
  try{world.applyDrive(racer,input,dt);}catch(e){if(e!==stop)throw e;}
  return racer;
};
for(const dt of [2,3,10]) {
  assert.equal(drive(30,{up:true,left:true},dt).speed,0);
  assert.equal(drive(-8,{down:true,right:true},dt).speed,0);
}
for(const dt of [1/30,1/60,1/144]) {
  const expected=(30+28*dt)*(1-0.5*dt);
  assert(Math.abs(drive(30,{up:true,left:true},dt).speed-expected)<1e-10);
  assert.equal(drive(30,{up:true},dt).speed,30+28*dt);
  assert.equal(drive(30,{up:true,left:true,right:true},dt).speed,30+28*dt);
}
console.log('OK: sequência persistida, resgate único, cooldown, ciclos épicos, saves antigos, sorteio de tickets e frenagem em curvas.');
