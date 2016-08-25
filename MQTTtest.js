var mqtt = require('mqtt');
var commander = require('commander');
//var redis = require('redis');

var Promise = require('bluebird')
var url = 'mqtt://127.0.0.1:1883';
var NUM = 50;//连接数
var times = 1;
var connections = [];
var subStart;
var model = 1;
commander.version('0.0.1')
		 .option('--host [type]','mqtt地址',url)
		 .option('--c [type]','连接数',NUM)
		 .option('--n [type]','每个连接发送消息次数',times)
		 .option('--t [type]','房间名','test')
		 .option('--M [type]','模式',model)//1只接收,0发送接收
		 .option('--m [type]','消息内容','test')
		 .parse(process.argv);

url = commander.host;
NUM = commander.c;

times = commander.n;
model = commander.M;
var topic = commander.t;
var msg = commander.m;
var time;
var key = 'msgCount';

if(!Object.prototype.watch)
{
	Object.prototype.watch = function (prop, handler)
	{
		var oldval = this[prop], newval = oldval,
			getter = function ()
			{
				return newval;
			},
			setter = function (val)
			{
				oldval = newval;
				return newval = handler.call(this, prop, oldval, val);
			};
		if (delete this[prop])
		{
			if (Object.defineProperty) // ECMAScript 5
			{
				Object.defineProperty(this, prop, {get: getter,set: setter});
			}
			else if (Object.prototype.__defineGetter__ && Object.prototype.__defineSetter__)
			{
				Object.prototype.__defineGetter__.call(this, prop, getter);
				Object.prototype.__defineSetter__.call(this, prop, setter);
			}
		}
	};
}

if (!Object.prototype.unwatch)
{
	Object.prototype.unwatch = function (prop)
	{
		var val = this[prop];
		delete this[prop];
		this[prop] = val;
	};
}

function Count(){
	this.successCount = 0;
	this.failCount = 0;
	this.msgCount = 0;
}
var count = new Count();
var msgCount = 0;
var failCount = 0;
var closeCount = 0;
count.watch('msgCount',function(a,b,c){
	console.log('msgCount:  ',a,b,c)
})
count.watch('failCount',function(a,b,c){
	console.log('failCount:   '+c);
})

var EventEmitter = require('events');
var util = require('util');

function MyEmitter(){
	EventEmitter.call(this)
}
util.inherits(MyEmitter,EventEmitter);

var event = new MyEmitter();
event.on('error',function(err){
	console.log('err',err);
})
event.on('count',function(con,failCount){

})
var subscribe =0;
var subscribes = [];
event.on('allSubscribed',function(){
/*	console.log(connections.length)
	for(var i = 0;i<connections.length;i++){
		(function(i){
			for(var t = 0;t<times;t++)
				connections[i].publish(topic,msg.toString()+i)
		})(i)
	}*/
	console.log('订阅耗时:',(Date.now() - subStart)/1000 + 's');
	console.log('wating.....................',model != 1)
	if(model != 1)
	setTimeout(function(){
		Promise.all(connections).then(function(clients){
			//console.log(clients)
			for(var i = 0;i<clients.length;i++){
				(function(i){
					for(var t = 0;t<times;t++)
						clients[i].publish(topic,msg.toString()+i)
				})(i)
			}
		})
	},8000)

})
//exec(NUM,times,topic,msg);

subStart = Date.now();
var msgStartTime;
console.log(topic)
for(var i = 0;i<NUM;i++){
	(function(i){

		var client = mqtt.connect(url, {
				username : Date.now() + i +"abc",
				password : 'nQ3kwtUkuNr7XGrRjuym7lHEpJWqChkWv0zSw3XQB1rVnFvKpk4sLeCeXktqVbXQ'
			}
			/*,{
			protocolId: 'MQIsdp',
			protocolVersion: 3
		}*/);

		client.on('connect',function(){
			//console.log(msg)
			client.subscribe(topic);
			subscribe ++;
			console.log(i+'连接成功');
			if(subscribe == NUM - failCount)
				event.emit('allSubscribed',true);
		})
		client.on('message',function(topic,msg){
			if(msgCount == 0)
				msgStartTime = Date.now();
			console.log(msg+ '       '  + (++msgCount)  + '    '+(Date.now()-msgStartTime)/1000+'s');
		})
		connections.push(client);
	})(i)
}


function exec(num,times,topic,msg){
	for(var i=0;i<num;i++){
		(function(i){
			var client = mqtt.connect(url,{
				protocolId: 'MQIsdp',
				protocolVersion: 3
			});
			client.on('connect',function(){
				//console.log(i+'connected');
				connections.push(client);
				//console.log(1)

				//var s = client.subscribe(topic); //进入房间
				subscribes.push(client.subscribe(topic))
				subscribe ++;
				if(subscribe == NUM)
					event.emit('allSubscribed',true);
			})
			client.on('message',function(topic,msg){
				console.log("h"+msg)
				msgCount++;
			})
			client.on('close',function(){
				closeCount ++;
			})
			client.on('error',function(){
				failCount ++;
			})
		})(i)
	}
}
var oldCount = msgCount;
var timeStart = Date.now();
var equalCount = 0;

/*
setInterval(function(){

	if(equalCount == 10){//done
		var done = Date.now();
		console.log('连接数：',NUM );
		console.log('发送消息总数:',NUM*times);
		console.log('接收消息总数:',msgCount);
		console.log('连接失败:',failCount);
		console.log('连接断开:',closeCount);
		console.log('花费时间:',done - timeStart);
		process.exit(1);

	}
	console.log(msgCount,oldCount,equalCount)
//	console.log(iiii)
	if(msgCount == oldCount)
		equalCount ++;
	else oldCount = msgCount;
},100)
*/


