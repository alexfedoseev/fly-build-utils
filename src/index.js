import { exec, fork, spawn } from 'child_process';
import webpack               from 'webpack';
import path                  from 'path';
import fs                    from 'fs';


module.exports = function() {

  /**
   * @desc Run script using one of the child_process methods
   *
   * @param {string} script           - Script to run.
   * @param {Object} params           - Run params.
   * @param {string} params.method    - child_process method: fork|exec|spawn.
   * @param {string[]} params.args    - Arguments for child_process method.
   * @param {string} params.resolveOn - Event on which Promise will be resolved.
   *
   * @returns {Promise}
   */

  this.run = function(script, params = {}) {

    const args = params.args || [];
    const done = params.resolveOn || 'exit';

    const NODE_ENV = process.env['NODE_ENV'] || 'development';
    const env      = Object.assign({}, process.env, { NODE_ENV });

    return new Promise(resolve => {

      switch (params.method) {

        case 'fork': {
          return (
            fork(script, args, { silent: false, env }).on(done, resolve)
          );
        }

        case 'exec': {
          return (
            exec(script, { env }).on(done, resolve)
          );
        }

        default: {
          return (
            spawn(script, args, { stdio: 'inherit', env }).on(done, resolve)
          );
        }

      }

    });

  };


  /**
   * @desc Run scripts async.
   *
   * @param {(string[]|Object[])} scripts - Scripts to run.
   *
   * @returns {Promise}
   */

  this.runAsync = function(scripts) {

    return (
      Promise.all(
        scripts
          .map(item => (
            typeof item === 'string' ?
            [ item ] :
            [ item.script, item.params || {} ]
          ))
          .map(args => this.run(...args))
      )
    );

  };


  /**
   * @desc Bundle array of servers.
   *
   * @param {Object} params           - Bundle params.
   * @param {string[]} params.bundles - Array of bundles.
   * @param {boolean} params.hot      - Server with hot reloading.
   *
   * @returns {Object[]}
   */

  this.getServers = function(params = {}) {

    const { bundles, hot } = params;
    const servers = (
      bundles || fs.readdirSync(path.resolve(process.cwd(), 'app', 'bundles'))
    );

    if (hot) {
      return (
        servers.map(server => ({
          script: 'scripts/nodemon',
          params: { args: [ `build/${server}.js` ] },
        }))
      );
    } else {
      return (
        servers.map(server => ({
          script: `build/${server}.js`,
          params: { method: 'fork' },
        }))
      );
    }

  };


  /**
   * @desc Copy static items.
   *
   * @param {Object[]} items     - Items to copy.
   * @param {string} item.target - Target item.
   * @param {string} item.dest   - Destination.
   *
   * @returns {Promise}
   */

  this.copy = function(items) {

    return Promise.all(
      items.map(item => (
        this.run(`cp -a ${item.target} ${item.dest}`, { method: 'exec' })
      ))
    );

  };


  /**
   * @desc Move static items.
   *
   * @param {Object[]} items     - Items to move.
   * @param {string} item.target - Target item.
   * @param {string} item.dest   - Destination.
   *
   * @returns {Promise}
   */

  this.move = function(items) {

    return Promise.all(
      items.map(item => (
        this.run(`mv ${item.target} ${item.dest}`, { method: 'exec' })
      ))
    );

  };


  /**
   * @desc Compile webpack build.
   *
   * @param {Object} config - Webpack config.
   *
   * @returns {Promise}
   */

  this.compile = function(config) {

    return new Promise(resolve => {
      webpack(config).run((err, stats) => {
        this.logWebpackData(err, stats);
        return resolve();
      });
    });

  }


  /**
   * @desc Compile webpack build and start watcher.
   *
   * @param {Object} config - Webpack config.
   *
   * @returns {Promise}
   */

  this.compileAndWatch = function(config) {

    let initialRun = true;

    return new Promise(resolve => {
      webpack(config).watch({}, (err, stats) => {
        this.logWebpackData(err, stats);
        if (initialRun) {
          initialRun = false;
          return resolve();
        }
      });
    });

  }


  /**
   * @desc Log webpack data.
   *
   * @param {*} err        - Error from Webpack.
   * @param {Object} stats - Webpack build stats.
   */

  this.logWebpackData = function(err, stats) {

    if (err) this.error(err);

    this.log(
      stats.toString({
        colors  : true,
        hash    : false,
        version : false,
        chunks  : false,
        children: false,
      })
    );

  }

}
