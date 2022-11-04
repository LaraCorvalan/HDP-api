const { Router } = require('express');
const {User, Room} = require('../db')


const router = Router();

// router.post('/room', async function (req, res){
//     try {
//         const {room} = req.body;
//         const rooms = await Room.create({
//            code: room
//         });
        
//         res.send(rooms)
//     } catch (error) {
//         console.log(error)
//     }
// })
// router.get('/room', async function (req, res){
//     try {
//         const {room} = req.body;
//         const allRooms = await Room.findAll();
        
//         res.send(allRooms)
//     } catch (error) {
//         console.log(error)
//     }
// })
// router.put('/room', async function (req, res){
//     try {
//         const {room} = req.body;
//         const rooms = await Room.update({
//             players:players+1,
//         },
//             {
//            where:{code: room}
//         });
        
        
//         res.send(rooms)
//     } catch (error) {
//         console.log(error)
//     }
// })
// router.put('/room/disconnect', async function (req, res){
//     try {
//         const {room} = req.body;
//         const rooms = await Room.update({
//             players:players+1,
//         },
//             {
//            where:{code: room}
//         });
        
        
//         res.send(rooms)
//     } catch (error) {
//         console.log(error)
//     }
// })

module.exports = router;