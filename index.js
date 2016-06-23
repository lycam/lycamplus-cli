var program = require('commander');
var lycamplusjs = require('lycamplusjs');

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

var oauth2URL =  process.env.OAUTH2_URL || 'http://oauth-dev.lycam.tv';
var apiURL =  process.env.API_URL || 'http://api-dev.lycam.tv';
// console.log('token', token);


// username=master
// &password=Qb6LrCX5KskAPhpnXIPl47f26eCHkO
// &grant_type=password&
// client_id=BWT8UYQBY1&
// client_secret=znqPiWzGNz6pPePWTUYDDX1ToHg68I

program
  .version('0.0.1')
  .option('-C, --chdir <path>', 'change the working directory')
  .option('-c, --config <path>', 'set config path. defaults to ./deploy.conf')
  .option('-T, --no-tests', 'ignore test hook');

program.on('--help', function () {
  console.log('  Examples:');
  console.log('');
  console.log('    $ custom-help --help');
  console.log('    $ custom-help -h');
  console.log('');
});

program
  .command('setup [env]')
  .description('run setup commands for all envs')
  .option('-s, --setup_mode [mode]', 'Which setup mode to use')
  .action(function (env, options) {
    var mode = options.setup_mode || 'normal';
    env = env || 'all';
    console.log('setup for %s env(s) with %s mode', env, mode);
  });

program
.command('configure [appkey] [appsecret]')
.description('run setup commands for all envs')
.option('-s, --setup_mode [mode]', 'Which setup mode to use')
.action(function (appkey, appsecret, options) {
  var mode = options.setup_mode || 'normal';
  appkey = appkey || 'all';
  function writeConfig(callback) {
    var config = {
      appKey: appkey,
      appSecret: appsecret,
      oauth2URL: oauth2URL,
      apiURL: apiURL,
    };
    fs.writeFile(configPath, JSON.stringify(config), function (err, data) {
      console.log('write configure for %s %s with %s mode', appkey, appsecret, mode);
    });
  }

  fs.exists(home, function (err, exist) {
    if (exist == false) {
      fs.mkdir(home, function (err, data) {
        writeConfig();
      });
    } else {
      writeConfig();
    }

  });

});

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
  .alias('ex')
  .description('execute the given remote cmd')
  .option('-e, --exec_mode <mode>', 'Which exec mode to use')
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
    console.log('    $ deploy exec sequential');
    console.log('    $ deploy exec async');
    console.log();
  });

function writeResult(path, data, callback) {
  fs.writeFile(path, JSON.stringify(data), function (err, result) {
    console.log('write data ', data);
    if (callback) {
      callback(err, result);
    }
  });
}

program
  .command('gifts')
  .alias('ex')
  .description('execute the given remote cmd')
  .option('-o, --output <file>', 'Which exec mode to use')
  .action(function (options) {
    console.log('exec  using %s mode', options.output);
    getClient().gift.list({}, function (err, data) {
      if (err) {
        console.error(err);
      }

      var path = options.output;
      if (path) {
        var  file = path + '.json'
        writeResult(file, data, function (err, result) {
          console.log('write result to file:', file);
        });
      }

      console.log(data);
    });

  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ deploy exec sequential');
    console.log('    $ deploy exec async');
    console.log();
  });


program
  .command('streams')
  .alias('ex')
  .description('execute the given remote cmd')
  .option('-o, --output <file>', 'Which exec mode to use')
  .action(function (options) {
    console.log('exec  using %s mode', options.output);
    getClient().stream.list({}, function (err, data) {
      if (err) {
        console.error(err);
      }

      var path = options.output;
      if (path) {
        var  file = path + '.json'
        writeResult(file, data, function (err, result) {
          console.log('write result to file:', file);
        });
      }

      console.log(data);
    });

  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ deploy exec sequential');
    console.log('    $ deploy exec async');
    console.log();
  });  

program
  .command('exec <cmd>')
  .alias('ex')
  .description('execute the given remote cmd')
  .option('-e, --exec_mode <mode>', 'Which exec mode to use')
  .action(function (cmd, options) {
    console.log('exec "%s" using %s mode', cmd, options.exec_mode);
  }).on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ deploy exec sequential');
    console.log('    $ deploy exec async');
    console.log();
  });

program
  .command('*')
  .action(function (env) {
    console.log('deploying "%s"', env);
  });

program.parse(process.argv);
