var gulp = require('gulp');
var cssmin = require('gulp-cssmin');
var uglify = require('gulp-uglify');
var nodemon = require('gulp-nodemon');
var gif = require('gulp-if');

var inProduction = process.env['NODE_ENV'] == 'production';

gulp.task('asset-css', function() {
  gulp.src('assets/css/main.css')
    .pipe(gif(inProduction, cssmin()))
    .pipe(gulp.dest('production/css'));
});


gulp.task('asset-js', function() {
  gulp.src('assets/js/*')
    .pipe(gif(inProduction, uglify()))
    .pipe(gulp.dest('production/js'));
});

gulp.task('build', ['asset-css', 'asset-js']);

gulp.task('watch-app', function() {
  nodemon({
    script: 'app.js',
    ext: 'js json',
    env: {'NODE_ENV': 'development'}
  });
});
