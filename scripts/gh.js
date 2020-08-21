const fs = require('fs-extra')
const path = require('path')
const getPkgRoot = pkg => path.resolve(__dirname, '../packages/' + pkg)

run()

async function run() {
    const pkgRoot = getPkgRoot('timecat')
    const name = 'timecat.global.js'
    const pkgDir = path.resolve(pkgRoot, 'dist')
    const source = path.resolve(pkgDir, name)
    const target = path.resolve(__dirname, '../docs/' + name)
    fs.removeSync(path.resolve(__dirname, '../docs'))
    fs.copySync(source, target)
    fs.copySync(path.resolve(__dirname, '../examples'), path.resolve(__dirname, '../docs'))
}
