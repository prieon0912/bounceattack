import test from 'node:test';
import assert from 'node:assert/strict';
import {InputDelayController} from '../public/src/network-delay.js';
test('peer latency gives the same small input buffer over direct and Redis paths',()=>{
  assert.equal(new InputDelayController().observe(10),1);
  assert.equal(new InputDelayController().observe(40),2);
  assert.equal(new InputDelayController().observe(100),4);
  assert.equal(new InputDelayController().observe(1000),12);
});
test('delay handles jitter, recovers and ignores invalid measurements',()=>{
  const d=new InputDelayController();
  for(let i=0;i<8;i++)d.observe(40);
  assert.equal(d.observe(400),3);
  for(let i=0;i<8;i++)d.observe(40);
  assert.equal(d.delay,2);
  assert.equal(d.observe(NaN),2);
  assert.equal(d.observe(-1),2);
});

test('a route change discards measurements from the previous transport',()=>{
  const d=new InputDelayController();
  for(let i=0;i<8;i++)d.observe(1000,'relay');
  assert.equal(d.observe(20,'direct'),1);
  assert.equal(d.observe(100,'relay'),4);
});
