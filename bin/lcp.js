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
    console.log(options);
    console.log('注销账户');
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



//  message command
program
  .command('msg <cmd> [param1] [param2] [param3]')
  .alias('m')
  .description('消息管理')
  .option('-o, --output <file>', '输出文件名')
  .action(function (cmd, param1, param2, param3, options) {
    console.log('exec  using %s mode', options.output);
    if (cmd == 'chat') {
      var topic = param1;
      var msg = param2;
      getClient().gift.chat(topic, msg, function (err, data) {
        if (err) {
          console.error(err);
        }
        console.log("send chat to:"+topic, msg);

        console.log(data);
      });
    }

  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp gift');
    console.log('    $ lcp gift send 9aa1bf90-1f5d-11e6-ba5e-c56c2a8bfd5d myVideo:dev-3b11e871-39fc-11e6-bac4-9f0d0e18eaa6 1');
    console.log();
  });


//  gift command
program
  .command('gift <cmd> [param1] [param2] [param3]')
  .alias('gi')
  .description('礼物管理')
  .option('-o, --output <file>', '输出文件名')
  .action(function (cmd, param1, param2, param3, options) {
    console.log('exec  using %s mode', options.output);
    if (cmd == 'list') {
      getClient().gift.list({}, function (err, data) {
        if (err) {
          console.error(err);
        }

        var path = options.output;
        if (path) {
          var  file = path;
          writeResult(file, data, function (err, result) {
            console.log('write result to file:', file);
          });
        }

        console.log(data);
      });
    }
    else if(cmd=="send"){
      var receiver = param1;
      var topic = param2;
      var giftId = param3;
      getClient().gift.send(receiver, topic, giftId, function (err, data) {
        if (err) {
          console.error(err);
        }
        console.log(data);
      });
    }

  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp gift');
    console.log('    $ lcp gift send 9aa1bf90-1f5d-11e6-ba5e-c56c2a8bfd5d myVideo:dev-3b11e871-39fc-11e6-bac4-9f0d0e18eaa6 1');
    console.log();
  });


//  account command
program
  .command('account <cmd> [params]')
    //短命令 - 简写方式')
  .alias('a')
  .description('用户账户管理')
  .option('-o, --output <file>', '输出文件名')
  .action(function (cmd, params, options) {
    if (cmd == 'show') {
      getClient().account.show(function (err, data) {
        if (err) {
          console.error(err);
        }
        output(options, data);   
      });
    } else if (cmd == 'update') {
      // todo
      getClient().account.update(params, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
       output(options, data);     
      });
    } else if (cmd == 'deposit') {
      console.log('账户充值');
      getClient().account.deposit(params, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        output(options, data);
      });
    } else if (cmd == 'balance') {
      console.log('获取余额');
      getClient().account.balance(function(err, data) {
        if (err) {
          console.log('ee');
          console.error(err);
          return;
        }
        output(options, data);
      });
    } else {
      console.log('unknown cmd %s', cmd);
    }


    function output(options, data) {
       var path = options.output;
      if (path) {
        var  file = path;
        writeResult(file, data, function (err, result) {
          console.log('write result to file:', file);
        });
      }

      console.log(data);
    }

  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp a show');
    console.log('    $ lcp a update 12345678');
    console.log('    $ lcp a deposit 500');
    console.log('    $ lcp a balance')
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
    // .option('-k, --keyword <mode>', '关键字')
    //注册一个callback函数
    .action(function (cmd, params, options) {

      if (cmd == 'search') {
        var resultsPerPage = options.rows || 10;
        var keyword = params || '';
        console.log('search streams  resultsPerPage %s %s', resultsPerPage, keyword);
        getClient().stream.search({ keyword: keyword, resultsPerPage: resultsPerPage }, function (err, data) {
          if (err) {
            console.error(err);
          }

          var path = options.output;
          if (path) {
            var  file = path;
            writeResult(file, data, function (err, result) {
              console.log('write result to file:', file);
            });
          }

          console.log(data);
        });
      } 
      else if (cmd == 'open') {
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
            })

          
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

          var path = options.output;
          if (path) {
            var  file = path;
            writeResult(file, data, function (err, result) {
              console.log('write result to file:', file);
            });
          }

          console.log(data);
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

          var path = options.output;
          if (path) {
            var  file = path;
            writeResult(file, data, function (err, result) {
              console.log('write result to file:', file);
            });
          }

          console.log(data);
        });
      } 
      else {
        console.log('unknown cmd %s', cmd);
      }

    }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp st search test -n 5');
    console.log('    $ lcp st open test -i 0');

    console.log();
  });


// argv
program.parse(process.argv);
