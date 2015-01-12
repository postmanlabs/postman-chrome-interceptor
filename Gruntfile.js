/*global module:false*/
module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    manifest: grunt.file.readJSON('extension/manifest.json'),

    shell: {
      configure_release: {
          options: { stdout: true, stderr: true },
          command: 'python scripts/configure.py --web_url production'
      },

      configure_staging: {
          options: { stdout: true },
          command: 'python scripts/configure.py --web_url staging'
      },

      configure_dev: {
          options: { stdout: true },
          command: 'python scripts/configure.py --web_url dev'
      },

      configure_syncstage: {
          options: { stdout: true },
          command: 'python scripts/configure.py --web_url syncstage'
      },

      configure_local: {
          options: { stdout: true },
          command: 'python scripts/configure.py --web_url local'
      }
    },

    compress: {
      main: {
          options: {
            archive: 'releases/v<%= manifest.version %>.zip'
          },
          files: [
            {src: ['extension/**', '!extension/tests/**', '!extension/manifest_key.json', '!extension/tester.html'], dest: '/'}, // includes files in path and its subdirs
          ]
        }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-handlebars');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-mindirect');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-shell');
  
  grunt.registerTask('package_release', ['shell:configure_release', 'compress']);
  grunt.registerTask('package_staging', ['shell:configure_staging', 'compress']);
  grunt.registerTask('package_dev', ['shell:configure_dev', 'compress']);
  grunt.registerTask('package_syncstage', ['shell:configure_syncstage', 'compress']);
  grunt.registerTask('package_local', ['shell:configure_local']);
  grunt.registerTask('configure_test', ['shell:configure_test']);

};