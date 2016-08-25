#!/usr/bin/env node
var program = require('commander');
var lycamplusjs = require('lycamplusjs');
var appInfo = require('./../package.json');

var fs = require('fs');
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

var home = getUserHome() + '/.lcp-cli';
var configPath = home + '/config.json';
var tokenPath = home + '/token.json';
// console.log('home', home);
var config = {};
var token = {};
try {
  config = require(configPath);

}catch (err) {
  config = {};
}

try {
  token = require(tokenPath);
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

program
.command('configure <appkey> <appsecret>')
.alias('co')
.description('命令行工具环境配置')
.option('-a, --apiurl <mode>', 'API服务器地址')
.option('-o, --oauthurl <mode>', '认证服务器地址')
.action(function (appkey, appsecret, options) {

  function writeConfig(callback) {

    var apiurl = options.apiurl || apiURL;
    var oauthurl = options.oauthurl || oauth2URL;

    var config = {
      appKey: appkey,
      appSecret: appsecret,
      oauth2URL: oauthurl,
      apiURL: apiurl,
    };
    fs.writeFile(configPath, JSON.stringify(config), function (err, data) {
      if (err) {
        console.error('写入环境配置出错', err);
      } else
        console.log('写入环境配置 %s %s 到 %s', appkey, appsecret, configPath);
    });
  }

  fs.exists(home, function (exist) {
    console.error(home, exist);

    if (exist == false) {
      fs.mkdir(home, function (err, data) {
        if (err)
          console.error('mkdir error', err, home);
        writeConfig();
      });
    } else {
      writeConfig();
    }

  });

}).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp co appkey appsecret');
    console.log('    $ lcp co appkey appsecret -o https://oauth.lycam.tv -a https://api.lycam.tv');
    console.log();
  });;

function getClient() {
  var lycamplus = new lycamplusjs(config);
  lycamplus.token  = token;
  return lycamplus;
}

function writeToken(token, callback) {

  fs.writeFile(tokenPath, JSON.stringify(token), function (err, data) {
    console.log('write token ', token);
    callback(err, data);
  });
}

program
  .command('login <username> <password>')
  .alias('lo')
  .description('用户登录')
  .action(function (username, password, options) {
    var options = config;
    options.username = username;
    options.password = password;
    var lycamplus = new lycamplusjs(options);
    console.log('options', options);
    lycamplus.auth('password', function (err, token) {
        console.log('auth', token);
        if (token) {

          writeToken(token, function (err, data) {
            console.log('login "%s" successed', username, token);
          });
        }

      });

  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ login useranem password');
    console.log();
  });

function writeResult(path, data, callback) {
  fs.writeFile(path, JSON.stringify(data, null, 2), function (err, result) {
    console.log('write data ', data);
    if (callback) {
      callback(err, result);
    }
  });
}
program
  .command('msg <cmd> [param1] [param2] [param3]')
  .alias('m')
  .description('消息管理')
  .option('-o, --output <file>', '输出文件名')
  .action(function (cmd,param1,param2,param3, options) {
    console.log('exec  using %s mode', options.output);
    if (cmd == 'chat') {
      var topic = param1;
      var msg = param2;
      
      getClient().gift.chat(topic,msg, function (err, data) {
        if (err) {
          console.error(err);
        }
        console.log("send chat to:"+topic,msg);

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


program
  .command('gift <cmd> [param1] [param2] [param3]')
  .alias('gi')
  .description('礼物管理')
  .option('-o, --output <file>', '输出文件名')
  .action(function (cmd,param1,param2,param3, options) {
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

        var path = options.output;
        if (path) {
          var  file = path;
          writeResult(file, data, function (err, result) {
            console.log('write result to file:', file);
          });
        }

        console.log(data);
      });
    } else {
      console.log('unknown cmd %s', cmd);
    }

  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ lcp a show');
    console.log();
  });

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

    console.log();
  });

program.parse(process.argv);
