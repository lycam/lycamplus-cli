#!/usr/bin/env node
var program = require('commander');
var fs = require('fs');
var exec = require('child_process').exec;

var lycamplusjs = require('lycamplusjs');
var appInfo = require('./../package.json');


function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

var home = getUserHome() + '/.lcp-cli';
var configPath = home + '/config.json';
// console.log('home', home);
var config = {};
var token = {};
try {
  config = require(configPath);
}catch (err) {
  config = {};
}

try {
  var clientConfig = config.apps[config.currentApp];
  var currentUser = clientConfig.currentUser;
  var tokenPath = clientConfig.users[currentUser];
  token = require(tokenPath);
  console.log("tokenPath",tokenPath,token);
}catch (err) {
  token = {};
}

// fs.exists(home, function (err, exist) {
//     config = require(configPath);
//     console.log("config",config);
//   });

var oauth2URL =  process.env.OAUTH2_URL || 'https://oauth.lycam.tv';
var apiURL =  process.env.API_URL || 'https://api.lycam.tv';
// console.log('token', token);


// username=master
// &password=Qb6LrCX5KskAPhpnXIPl47f26eCHkO
// &grant_type=password&
// client_id=BWT8UYQBY1&
// client_secret=znqPiWzGNz6pPePWTUYDDX1ToHg68I

program
  .version(appInfo.version)
  // .option('-C, --chdir <path>', 'change the working directory')
  // .option('-c, --config <path>', 'set config path. defaults to ./deploy.conf')
  .option('-T, --no-tests', 'ignore test hook');

program.on('--help', function () {
  console.log('  Examples:');
  console.log('');
  console.log('    $ lcp --help');
  console.log('    $ lcp -h');
  console.log('    $ lcp st -h');
  console.log('');
});



// tool functions
// 1. getClient by currentApp
function getClient() {
  var clientConfig = config.apps[config.currentApp];
  // console.log("clientConfig",clientConfig);
  var lycamplus = new lycamplusjs(clientConfig);
  lycamplus.token  = token;
  return lycamplus;
}

// 2. wirte config to configPath
function writeConfig(config,callback) {
    fs.writeFile(configPath, JSON.stringify(config), function (err, data) {
      if (err) {
        console.error('写入环境配置出错', err);
      } else
        console.log('写入环境配置到 %s', configPath);
    });
}

// 3. write token to *.token.json file
function writeToken(key, token, callback) {  
  var tokenPath = home + '/'+key+'.token.json';
  console.log('tokenPath',tokenPath);
  fs.writeFile(tokenPath, JSON.stringify(token), function (err, data) {
    console.log('write token ', token);
    callback(err, tokenPath);
  });
}

// 4. writeResult function
function writeResult(path, data, callback) {
  fs.writeFile(path, JSON.stringify(data, null, 2), function (err, result) {
    console.log('write data ', data);
    if (callback) {
      callback(err, result);
    }
  });
}

// 5. output function 
function output(path, data) {
  if (path) {
        var  file = path;
        writeResult(file, data, function (err, result) {
        console.log('write result to file:', file);
    });
  }

  console.log(data);
}



// commands 
//  config command
program
.command('configure <appkey> <appsecret> [name]')
.alias('co')
.description('命令行工具环境配置')
.option('-a, --apiurl <mode>', 'API服务器地址')
.option('-o, --oauthurl <mode>', '认证服务器地址')
.action(function (appkey, appsecret, name, options) {

  function writeAppConfig(callback) {

    var apiurl = options.apiurl || apiURL;
    var oauthurl = options.oauthurl || oauth2URL;

    var conf = {
      appKey: appkey,
      appSecret: appsecret,
      oauth2URL: oauthurl,
      apiURL: apiurl,
    };
    var path = home + '/'+appkey+'.json';
    // console.log('写入环境配置', path);
    fs.writeFile(path, JSON.stringify(conf), function (err, data) {
      if (err) {
        console.error('写入环境配置出错', err);
      } else{
        console.log('写入环境配置 %s %s 到 %s', appkey, appsecret, path);
        config.currentApp = appkey;
        var apps = config.apps || {};
        apps[appkey] = conf;
        conf.name = name || "noname";
        config.apps = apps;
        writeConfig(config,function(err,data){
          callback(err, data);
        });
        
      }
    });
  }

  fs.exists(home, function (exist) {
    console.error(home, exist);

    if (exist == false) {
      fs.mkdir(home, function (err, data) {
        if (err)
          console.error('mkdir error', err, home);
        writeAppConfig();
      });
    } else {
      writeAppConfig();
    }

  });

}).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp co appkey appsecret');
    console.log('    $ lcp co appkey appsecret testapp');
    console.log('    $ lcp co appkey appsecret -o https://oauth.lycam.tv -a https://api.lycam.tv');
    console.log();
  });

// sdk
// login command
program
  .command('login <username> <password>')
  .alias('lo')
  .description('用户登录')
  .action(function (username, password, options) {

    var clientConfig = config.apps[config.currentApp];
    console.log("clientConfig",clientConfig);
    var options = clientConfig;
    options.username = username;
    options.password = password;
    var lycamplus = new lycamplusjs(options);
    console.log('options', options);
    lycamplus.auth('password', function (err, token) {
        console.log('auth', token);
        if (token) {
          var key = config.currentApp+"."+username;

          writeToken(key,token, function (err, tokenPath) {
            console.log('login "%s" successed', username, token);
            config.apps = config.apps || {};
            config.apps[config.currentApp] = config.apps[config.currentApp] || {};
            config.apps[config.currentApp].users = config.apps[config.currentApp].users || {};
            config.apps[config.currentApp].users[username] = tokenPath;
            config.apps[config.currentApp].currentUser = username;
            
            writeConfig(config,function(err,data){
              
            });
            
          });
        }

      });

  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp login username password');
    console.log();
  });


// account logout
program
  .command('logout')
  .alias('lg')
  .description('注销账户')
  .action(function(options) {
    console.log(' 注销账户');
    getClient().account.logout(function(err, data) {
      if (err) {
        console.error(err);
        return;
      }
      fs.unlink(tokenPath, function(err) {
        if (err) {
          console.error(err);
        } else {
          console.log(data);
        }
      });
    });
  })
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp logout');
    console.log();
  });



// message command
program
  .command('msg <cmd> [param1] [param2]')
  .alias('m')
  .description('消息管理')
  .option('-o, --output <file>', '输出文件名')
  .option('-a, --metaInfo <mode>', '额外信息')
  .action(function (cmd, param1, param2, options) {
    console.log('exec  using %s mode', options.output);
    if (cmd == 'chat') {
      console.log('发送消息');
      var topic = param1;
      var msg = param2;
      getClient().msg.chat(topic, msg, function (err, data) {
        if (err) {
          console.error(err);
        }
        output(options.output, data);
      });
    } else if (cmd === 'like') {
      console.log(' 点赞');
      var topic = param1;
      getClient().msg.like(topic, function(err, data) {
        if (err) {
          console.error(err);
          return;
        } 
        output(options.output, data);
      });

    } else if (cmd === 'barrage') {
      console.log('发送弹幕');
      
      getClient().msg.barrage(param1, param2, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      });

    } else if (cmd === "customize") {
      console.log('发送自定义消息');
      var topic = param1;
      var type = param2;
      var metaInfo = options.metaInfo || '';

      getClient().msg.customize(topic, type, metaInfo, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      });

    } else if (cmd === 'clients') {
      console.log('获取client在线数量');
      getClient().msg.clientCount(param1, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      });
    } else {
      console.log('unknown cmd %s', cmd);
    }

  }).on('--help', function () {
    console.log();
    console.log('  Commands:');
    console.log();
    console.log('    chat <channel> <msg> [-a]      发送消息');
    console.log('    like <topic>                   点赞');
    console.log('    barrage <topic> <msg>          弹幕');
    console.log('    customize <topic> <type> [-a]  自定义消息');
    console.log('    clients <topic>                获取在线用户数');
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('   $ lcp msg chat room/channeId `你好` -a {date: 2016-06-03}');
    console.log('   $ lcp msg like room/channeId');
    console.log('   $ lcp msg barrage room/channeId hello');
    console.log('   $ lcp msg customize room/channeId 1 -a {phone: `85869635`}');
    console.log('   $ lcp msg clients room/channel1');
    console.log();
  });


//  gift command
program
  .command('gift <cmd> [param1] [param2] [param3]')
  .alias('gi')
  .description('礼物管理')
  .option('-o, --output <file>', '输出文件名')
  .option('-s, --sort <mode>', '排序字段(sum,time，默认time)')
  .option('-d, --order <mode>', '排序方向(asc,desc，默认 desc)')
  .action(function (cmd, param1, param2, param3, options) {
    console.log('exec  using %s mode', options.output);
    if (cmd == 'list') {
      console.log('获取礼物清单');
      getClient().gift.gifts(function (err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      });
    } else if(cmd=="send"){
      console.log('发送礼物');
      var receiver = param1;
      var topic = param2;
      var giftId = param3;
      getClient().gift.send(receiver, topic, giftId, function (err, data) {
        if (err) {
          console.error(err);
        }
        console.log(data);
      });
    } else if (cmd === 'records') {
      console.log('获取用户交易记录');

      var rows = param1;
      var type = param2;
      var page = param3;
      var paramsObject = {};
      options.order && (paramsObject['order'] = options.order);
      options.sort && (paramsObject['sort'] = options.sort);

      getClient().gift.record(rows, type, page, 
            paramsObject,function(err, data) {
              if (err) {
                console.error(err);
                return;
              }
              console.log(data);
      });
    } else if (cmd === 'contributors') { 
      console.log('礼物贡献者');

      var resultsPerPage = param1;
      var page = param2;

      getClient().gift.contributors(resultsPerPage, page, function(eer,  data) {
        if (err) {
          console.error(err);
          return;
        } 
        console.log(data);
      });

    } else {
       console.log('unknown cmd %s', cmd);
    } 

  }).on('--help', function () {
    console.log();
    console.log(' Commands:');
    console.log();
    console.log('   list                                  获取礼物清单');
    console.log('   send <giftId> <receiver> <streamId>   发送礼物');
    console.log('   records <resultsPerPage> <type> ');
    console.log('           <page> [-s] [-o]              获取用户交易记录');
    console.log('   contributors <resultsPerPage> <page>  礼物贡献者');
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp gift list');
    console.log('    $ lcp gift send 9aa1bf90-1f5d-11e6-ba5e-c56c2a8bfd5d myVideo:dev-3b11e871-39fc-11e6-bac4-9f0d0e18eaa6 1');
    console.log('    $ lcp gift records 10 1 1');
    console.log('    $ lcp gift contributors 10 1');
    console.log();
  });




//  account command
program
  .command('account <cmd> [param1] [param2]')
    //短命令 - 简写方式')
  .alias('at')
  .description('用户账户管理')
  .option('-o, --output <file>', '输出文件名')
  .option('-r, --rows <mode>', '每页纪录数')
  .option('-p, --page <mode>', '返回第几页')
  .option('-s, --sort <mode>', '排序字段(id,name,created)')
  .option('-d, --order <mode>', '排序方向<asc,desc>')
  .option('-u, --uuid <required>', '用户uuid')
  .option('-a, --active <required>', '激活状态')
  .option('--username <required>', '用户名6-80位，如果为空将随机生成')
  .option('--password <required>', '用户密码，大于等于8位，如果为空将随机生成')
  .option('--email <required>', '邮件地址')
  .option('--phone <required>', '手机号码11-20位')
  .option('--description <required>', '描述')
  .option('--displayName <required>', '显示的昵称，2-20位，可以为空')
  .option('--metaInfo <required>', '自定义用户信息，格式为json')
  .action(function (cmd, param1, param2, options) {
    if (cmd == 'create') {
      console.log(' 创建用户');
      
      // make json object
      var paramsObject = {};
      options.username && (paramsObject['username']=options.username);
      options.password && (paramsObject['password']=options.password);
      options.email && (paramsObject['email']=options.email);
      options.phone && (paramsObject['phone']=options.phone);
      options.description && (paramsObject['description']=options.description);
      options.displayName && (paramsObject['displayName']=options.displayName);
      options.metaInfo && (paramsObject['metaInfo']=options.metaInfo);

      getClient().user.create(paramsObject, function(err, data) {
        if (err) {
          console.error(err)
          return;
        }
        output(options.output, data);
      });

    } else if (cmd == 'search') {
      console.log('  搜索用户');

      var paramsObject = {};
      param1 && (paramsObject['username']=param1);
      options.phone && (paramsObject['phone']=options.phone);
      options.rows && (paramsObject['resultsPerPage']=options.rows);
      options.page && (paramsObject['page']=options.page);
      options.sort && (paramsObject['sort']=options.sort);
      options.order && (paramsObject['order']=options.order);

      getClient().user.search(paramsObject, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      })

    } else if (cmd == 'list') {
      console.log(' 获取用户列表');
      if (param1) {
          getClient().user.listSince(param1, 10, function(err, data) {
            if (err) {
              console.error(err);
              return;
            }
            output(options.output, data);
          });
      } else {
          getClient().user.list({}, function(err, data) {
          if (err) {
            console.error(err);
            return;
          }
          output(options.output, data);
        });
      }
    } else if (cmd == 'assume') {
      console.log(' 获取用户授权token');
      if (!options.uuid) {
        console.error('  获取token需要参数uuid');
        return;
      }
      getClient().user.assumeUser(options.uuid, '*', '360000', function(err, data) {
        if (err) {
          console.error(error);
          return;
        }
        output(options.output, data);
      });
    } else if (cmd == 'show') {
      console.log(' 查询账户信息');
      getClient().account.show(function (err, data) {
        if (err) {
          console.error(err);
        }
        output(options.output, data);  
      });
    } else if (cmd == 'passwd') {
      console.log(' 修改账户密码');
      if (!options.uuid || !options.password) {
        console.error('需要提供uuid和新密码');
        return;
      }
      getClient().user.updatePassword(options.uuid, options.password, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }

        output(options.output, data);
      });
    } else if (cmd == 'upuser') {
      console.log(' 更新用户细节信息');

      if (!options.uuid) {
        console.error(' 必须指定一个uuid');
        return;
      }

      var paramsObject = {};
      options.active && (paramsObject['active']=options.active);
      options.email && (paramsObject['email']=options.email);
      options.phone && (paramsObject['phone']=options.phone);
      options.description && (paramsObject['description']=options.description);
      options.displayName && (paramsObject['displayName']=options.displayName);
      options.metaInfo && (paramsObject['metaInfo']=options.metaInfo);

      getClient().user.update(options.uuid, paramsObject, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      });
    } else if (cmd == 'upacc') {

      console.log(' 更新账户信息');
      
      var paramsObject = {};
      options.description && (paramsObject['description']=options.description);
      options.displayName && (paramsObject['displayName']=options.displayName);

      getClient().account.update(paramsObject, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
       output(options.output, data);    
      });

    } else if (cmd == 'deposit') {

      console.log(' 账户充值');
      getClient().account.deposit({money: param1}, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      });

    } else if (cmd == 'balance') {
      console.log(' 获取余额');
      getClient().account.balance(function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      });
    } else if (cmd == 'withdraw') {
      console.log('提现');
      getClient().account.withdraw(param1, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options.output, data);
      });
    } else if (cmd == 'transfer') {
      console.log('转账');
      getClient().account.transfer(param1, param2, function(err, data) {
        if (err) {
          console.error(error);
          return;
        }
        output(options.output, data);
      });
    } else {
      console.log('unknown cmd %s', cmd);
    }

  }).on('--help', function () {
    console.log();
    console.log('  Commands:');
    console.log();
    console.log('    create [--username] [--password] [--email]');
    console.log('           [--description] [--phone]');
    console.log('           [--displayName] [--metaInfo]        创建用户');
    console.log('    search [username] [--phone] [-r] [-p] [-d] 搜索用户');
    console.log('    list [timestamp]                           获取用户列表(0代表最新)')
    console.log('    assume <token>                             获取用户授权token');
    console.log('    passwd <-u> <--password>                   更新用户密码');
    console.log('    upuser <-u> [-c] [--phone] [--description]');
    console.log('           [--email] [--displayName]'); 
    console.log('           [--metaInfo]                        更新用户细节信息');
    console.log('    show                                       获取账户信息');           
    console.log('    upacc [--description] [--displayName]      更新账户信息');
    console.log('    deposit <money>                            充值');
    console.log('    balance                                    获取余额');
    console.log('    withdraw <money>                           提现');
    console.log('    transfer <receiverId> <money>              转账');
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp at create --username BlueSmith --password 12345678');
    console.log('                     --metaInfo {avatarUrl:"profile.png"}');
    console.log('    $ lcp at search tester --phone 15928753685 -d desc');
    console.log('    $ lcp at list 0');
    console.log('    $ lcp at assume 4fa95980-763d-11e6-9610-f5df51643a4d');
    console.log('    $ lcp at passwd -u 4fa95980-763d-11e6-9610-f5df51643a4d');
    console.log('                     --password 12345678');
    console.log('    $ lcp at upuser -u 4fa95980-763d-11e6-9610-f5df51643a4d');
    console.log('                     -email 66@gmail.com')
    console.log('    $ lcp at show');
    console.log('    $ lcp at upacc --description 1234 --displayName 5678');
    console.log('    $ lcp at deposit 500');
    console.log('    $ lcp at balance');
    console.log('    $ lcp at withdraw 100');
    console.log('    $ lcp at transfer abcd1234 100');
    console.log();
  });


//  app command
program
  .command('app <cmd> [params]')
    //短命令 - 简写方式')
  .alias('a')
  .description('APP管理')
  .option('-o, --output <file>', '输出文件名')
  .action(function (cmd, params, options) {
    if (cmd == 'list') {
      console.log("total:"+ Object.keys(config.apps).length);
      console.log("current:"+ config.currentApp);
      for(var i in config.apps){
        var app = config.apps[i];
        console.log(i+":"+app.appSecret+" "+ (app.name||""));
      }

    } 
    else if (cmd == 'set') {
      var index = parseInt(params) || 0;

      var key = Object.keys(config.apps)[index]

      console.log("current:"+ key);
      config.currentApp = key;

      writeConfig(config,function(err,data){
              
      });

    } else {
      console.log('unknown cmd %s', cmd);
    }

  }).on('--help', function () {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp app list');
    console.log();
  });


//  stream command
//像git风格一样的子命令
program
    //子命令
    .command('stream <cmd> [params]')
    //短命令 - 简写方式
    .alias('st')
    //说明
    .description('视频流管理')
    //resume的子命令
    .option('-o, --output <mode>', '输出文件名')
    .option('-n, --rows <mode>', '每页纪录数')
    .option('-i, --index <mode>', '第几条纪录')
    .option('-p, --page <mode>', '返回第几页')
    .option('-s, --sort <mode>', '排序字段(id,description,created)')
    .option('-d, --order <mode>', '排序方向<asc,desc>')
    .option('-r, --radius <model>', '搜索半径')
    .option('--uuid <mode>', '视频的创建用户uuid')
    .option('--lat <mode>', '开始视频的维度坐标')
    .option('--lon <mode>', '开始视频的经度坐标')
    .option('--city <mode>', '城市')
    .option('--state <mode>', '省份')
    .option('--country <mode>', '国家')
    .option('--privacy <mode>', '是否私有视频')
    .option('--title <model>', '标题，2-32位')
    .option('--description <mode>.', '视频描述，2-160位')
    .option('--thumbnail <mode>', '视频封面图片 URL')
    .option('--extra <mode>', '自定义json格式用户信息')
    // .option('-k, --keyword <mode>', '关键字')
    //注册一个callback函数
    .action(function (cmd, params, options) {

      if (cmd == 'create') {
        console.log('  创建视频流');

         var paramsObject = {};
         options.uuid && (paramsObject['uuid'] = options.uuid);
         options.lat && (paramsObject['startLat'] = options.lat);
         options.lon && (paramsObject['startLon'] = options.startLon);
         options.city && (paramsObject['city'] = options.city);
         options.state && (paramsObject['state'] = options.state);
         options.country && (paramsObject['country'] = options.country);
         options.privacy && (paramsObject['privacy'] = options.privacy);
         options.title && (paramsObject['title'] = options.title);
         options.description && (paramsObject['description'] = options.description);
         options.thumbnail && (paramsObjectp['thumbnailUrl'] = options.thumbnail);
         options.extra && (paramsObject['extraInfo'] = options.extra);
         
         getClient().stream.create(paramsObject, function(err, data) {
          if (err) {
            console.error(err);
            return;
          }
          output(options.output, data);
        });

      } else if (cmd == 'update') {

         if (!params) {
           console.error('  请指定一个stream_id');
           return;
         }

         var paramsObject = {};
         options.lat && (paramsObject['startLat'] = options.lat);
         options.lon && (paramsObject['startLon'] = options.startLon);
         options.city && (paramsObject['city'] = options.city);
         options.state && (paramsObject['state'] = options.state);
         options.country && (paramsObject['country'] = options.country);
         options.privacy && (paramsObject['privacy'] = options.privacy);
         options.title && (paramsObject['title'] = options.title);
         options.description && (paramsObject['description'] = options.description);
         options.thumbnail && (paramsObjectp['thumbnailUrl'] = options.thumbnail);
         options.extra && (paramsObject['extraInfo'] = options.extra);


         getClient().stream.update(params, paramsObject, function(err, data) {
           if (err) {
             console.error(err);
             return;
            }
            output(options.output, data);
         });
        
        console.log(' 更新视频信息');

      } else if (cmd == 'list') {
        var resultsPerPage = options.rows || 10;
        var page = options.page || 1;
        var sort = options.sort || 'id';
        var order = options.order || 'desc';
        console.log('获取用户视频流列表, 当前显示第%d页，每页显示%d条记录，按照`%s`排序，排序方式为`%s`', page, resultsPerPage, sort, order);
        getClient().stream.list({resultsPerPage: resultsPerPage, page: page, sort: sort, order: order}, function(err, data) {
          if (err) {
            console.error(err);
            return;
          }
         output(options.output, data);
        });
      } else if (cmd == 'show') {
        console.log(' 查看指定id视频流');
        if (!params) {
          console.error('请指定一个stream_id');
          return;
        }
        getClient().stream.show(params, function(err, data) {
          if (err) {
            console.error(err);
            return;
          }

          output(options.output, data);
        });

      } else if (cmd == 'lsince') {
        console.log('  获取指定时间前视频流列表');
        if (!params) {
          console.error('  请指定timestamp');
          return;
        }
        getClient().stream.listSince(params, options.rows || 10, function(err, data) {
          if (err) {
            console.error(err);
            return;
          }
         output(options.output, data);
        });

      } else if (cmd == 'search') {
        var resultsPerPage = options.rows || 10;
        var keyword = params || '';
        console.log('search streams resultsPerPage %s %s', resultsPerPage, keyword);
        getClient().stream.search({ keyword: keyword, resultsPerPage: resultsPerPage }, function (err, data) {
          if (err) {
            console.error(err);
          }
          output(options.output, data);
        });
      } else if (cmd == 'location') {
        console.log('地域搜索');
        var paramsObject = {};
        options.lat && (paramsObject['startLat'] = options.lat);
        options.lon && (paramsObject['startLon'] = options.startLon);
        options.radius && (paramsObject['radius'] = options.radius);
        options.rows && (paramsObject['resultsPerPage'] = options.rows);
        options.page && (paramsObject['page'] = options.page);
        options.sort && (paramsObject['sort'] = options.sort);
        options.order && (paramsObject['order'] = options.order);

        getClient().stream.searchLocation(paramsObject, function(err, data) {
          if (err) {
            console.error(err);
            return;
          }
          output(options.output, data);
        }); 
        

      } else if (cmd == 'open') {
        var resultsPerPage = options.rows || 10;
        var keyword = params || '';
        var index = options.index || 0;
        
        console.log('search streams  resultsPerPage %s %s', resultsPerPage, keyword);
        getClient().stream.search({ keyword: keyword, resultsPerPage: resultsPerPage }, function (err, data) {
          if (err) {
            console.error(err);
          }

          // console.log(data);
          if(data.items.length>0){
            if(index+1>data.items.length){
              index = data.items.length-1;
            }
            var item = data.items[index];
            var cmd = "open " + item.streamUrl;
            console.log(cmd);
            console.log("index:",index);
            exec(cmd, function callback(error, stdout, stderr) { 
              console.log(stdout);
            });

          }
        });
      } 
      else if (cmd == 'start') {
        var resultsPerPage = options.rows || 10;
        var streamId = params || '';
        console.log('start streams  resultsPerPage %s %s', resultsPerPage, keyword);
        getClient().stream.start(streamId,{}, function (err, data) {
          if (err) {
            console.error(err);
          }
          output(options.output, data);
        });
      } 
      else if (cmd == 'stop') {
        var resultsPerPage = options.rows || 10;
        var streamId = params || '';
        console.log('stop streams  resultsPerPage %s %s', resultsPerPage, keyword);
        getClient().stream.stop(streamId, function (err, data) {
          if (err) {
            console.error(err);
          }
          output(options.output, data);
        });
      } else if (cmd == 'delete') {
        
        console.log(' 删除视频流');
        if (!params) {
          console.error(' 请指定一个stream_id');
          return;
        }
        getClient().stream.destroy(params, function(err, data) {
          if (err) {
            console.error(err);
            return;
          }
         output(options.output, data);
        });
      } else {
        console.log('unknown cmd %s', cmd);
      }

    }).on('--help', function () {
      console.log();
      console.log('  Commands:');
      console.log();
      console.log('    create [--uuid] [--lat] [--lon] [--city]');
      console.log('           [--state] [--country] [--privacy]');
      console.log('           [--title] [--description] [--thumbnail]');
      console.log('           [--extra]             创建视频流');
      console.log('    update <stream_id>  [--lat] [--lon] [--city]');
      console.log('           [--state] [--country] [--privacy]');
      console.log('           [--title] [--description] [--thumbnail]');
      console.log('           [--extra]             更新视频流');
      console.log('    list   [-n] [-p] [-s] [-d]   获取用户视频流列表');
      console.log('    lsince <timestamp> [-n]      获取指定时间前视频流列表')
      console.log('    show   <stream_id>           查看指定id视频');
      console.log('    search [-n] [keyword]        视频搜索');
      console.log('    location <--lon> <--lat> <-r>');
      console.log('             [-s] [-d] [-n] [-p] 地域搜索');
      console.log('    open   [-i] [-n] [keyword]   打开视频流');
      console.log('    delete <stream_id>           删除指定id视频');
      console.log();
      console.log('  Examples:');
      console.log();
      console.log('    $ lcp st create');
      console.log('    $ lcp st list');
      console.log('    $ lcp st lsince 0 -n 10');
      console.log('    $ lcp st update 8201f580-7670-11e6-9961-013afbd5c525 --title hello');
      console.log('    $ lcp st show 8201f580-7670-11e6-9961-013afbd5c525');
      console.log('    $ lcp st search test -n 5');
      console.log('    $ lcp st location -r 50 --lon 400 --lat 500');
      console.log('    $ lcp st open test -i 0');
      console.log('    $ lcp st delete c86b0af0-766d-11e6-a535-1b9eb3833833');
      console.log();
  });


// argv
program.parse(process.argv);
