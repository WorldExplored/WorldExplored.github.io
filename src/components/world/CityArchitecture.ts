import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, ExtrudeGeometry, Shape, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3 } from 'three';
import { floorSlab, floorRectangle, floorEllipse, type FloorPolygon } from './InteriorKit';
import { buildCityInterior } from './CityInteriors';
import { createFacadeGarden } from './FacadeGarden';
import { cityEntrances, type CityBuilding, type CityPoint } from './city';

export type CityFinish = 'porcelain' | 'glass' | 'aqua' | 'garden' | 'window' | 'stone' | 'wood' | 'fabric' | 'metal';
export type CityAdd = (geometry: BufferGeometry, finish: CityFinish, x?: number, y?: number, z?: number, sx?: number, sy?: number, sz?: number, rotation?: number) => void;
export interface CityRoomView { building: string; window: CityPoint; target: CityPoint; floor: number; width: number; height: number; depth: number }

export function cityRoundedBox(width: number, height: number, depth: number, corner = .16) {
  const r = Math.min(corner, width / 2, depth / 2); const x = width / 2; const z = depth / 2;
  const shape = new Shape();
  shape.moveTo(-x + r, -z); shape.lineTo(x - r, -z); shape.quadraticCurveTo(x, -z, x, -z + r);
  shape.lineTo(x, z - r); shape.quadraticCurveTo(x, z, x - r, z); shape.lineTo(-x + r, z); shape.quadraticCurveTo(-x, z, -x, z - r);
  shape.lineTo(-x, -z + r); shape.quadraticCurveTo(-x, -z, -x + r, -z);
  return new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 5 }).rotateX(-Math.PI / 2);
}

export interface CityLiftPlan { building: string; x: number; z: number; floors: number[]; top: number }
export type CityInteriorRecipe = (add: CityAdd) => void;
export function buildCityArchitecture(building: Readonly<CityBuilding>, shellAdd: CityAdd, onLift?: (plan: CityLiftPlan) => void, deferInterior?: (recipe: CityInteriorRecipe) => void) {
  let add = shellAdd;
  const roomViews: CityRoomView[] = [];
  const foundationPolygons: FloorPolygon[] = [];
  let roomIndex=0;
  const access: { room: string; x: number; back: number; floor: number; height: number }[] = [];
  const fronts: { x: number; z: number; width: number; floor: number }[] = [];
  const sideFaces: { x: number; y: number; z: number; width: number; depth: number; height: number; room: string }[] = [];
  const { width: w, depth: d, height: h, family } = building;
  const glazed = ['terraced-apartments', 'narrow-mixed-use', 'rounded-housing', 'greenhouse-residences', 'winter-glasshouse'].includes(family);
  const cladding: CityFinish = ['waterfront-rowhouses','split-level-homes','stacked-maisonettes'].includes(family) ? 'wood' : family === 'arched-apartments' ? 'metal' : 'stone';
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number, finish: CityFinish = 'porcelain', yaw = 0) => add(new BoxGeometry(width, height, depth), finish, x, y, z, 1, 1, 1, yaw);
  const slab = (x: number, y: number, z: number, width: number, depth: number, finish: CityFinish = 'stone', corner = .12) => {const geometry=cityRoundedBox(width,.13,depth,corner);geometry.name=`${building.id}-exterior-slab`;geometry.userData.exteriorSlab=true;add(geometry,finish,x,y,z);};
  const plant = (x: number, y: number, z: number, scale = 1) => {
    add(new CylinderGeometry(.14, .1, .24, 8), 'stone', x, y + .12 * scale, z, scale, scale, scale);
    add(new CylinderGeometry(.008, .016, .35, 7), 'wood', x, y + .38 * scale, z, scale, scale, scale);
    for (let leaf = 0; leaf < 9; leaf++) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute([0,0,0, -.065,.09,.09, -.05,.13,.20, 0,.10,.31, .05,.13,.20, .065,.09,.09, 0,.16,.14],3));
      geometry.setIndex([6,0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0]); geometry.computeVertexNormals();
      geometry.rotateX(-.3 + leaf % 3 * .3).rotateY(leaf * 2.399);
      add(geometry, 'garden', x, y + (.28 + leaf * .024) * scale, z, scale, scale, scale);
    }
  };
  const grapeTrellis = (x: number, y: number, z: number, width: number) => {
    for (const side of [-1,1]) {
      box(x+side*width/2,y+.92,z,.07,1.84,.07,'wood');
      box(x+side*width/2,y+.12,z,.30,.24,.34,'stone');
      const stem=new CatmullRomCurve3(Array.from({length:12},(_,i)=>new Vector3(x+side*width/2+Math.sin(i*1.5)*.025,y+.24+i*.14,z+Math.cos(i*1.5)*.025)));
      add(new TubeGeometry(stem,28,.014,6,false),'wood');
      for(let i=0;i<12;i++) {
        const leaf=new Shape();leaf.moveTo(0,0);leaf.lineTo(-.08,.04);leaf.lineTo(-.07,.09);leaf.lineTo(-.13,.12);leaf.lineTo(-.07,.16);leaf.lineTo(0,.23);leaf.lineTo(.07,.16);leaf.lineTo(.13,.12);leaf.lineTo(.07,.09);leaf.lineTo(.08,.04);leaf.closePath();
        const geometry=new ExtrudeGeometry(leaf,{depth:.006,bevelEnabled:false}).rotateX(-.3).rotateY(side*.45+i*.71);
        add(geometry,'garden',x+side*width/2,y+.3+i*.115,z+.04);
      }
    }
    box(x,y+1.84,z,width+.12,.055,.055,'wood');
    for(const side of [-1,1])for(const height of [.65,1.1,1.55])box(x+side*width/2,y+height,z,.025,.025,.34,'metal');
    for(let bunch=0;bunch<4;bunch++) for(let grape=0;grape<13;grape++) {
      const row=Math.floor(grape/4),a=grape*2.399,r=.075*(1-row*.22);
      add(new SphereGeometry(.043,8,6),'garden',x-width*.35+bunch*width*.23+Math.cos(a)*r,y+1.5-row*.055,z+.10+Math.sin(a)*r);
    }
  };
  const furnishing=(x:number,y:number,z:number,width:number,depth:number,variant:number,height=1.8)=>buildCityInterior(building,add,x,y,z,width,depth,variant,height);
  const furnishRoom = (...args: Parameters<typeof furnishing>) => {
    if (!deferInterior) { furnishing(...args); return; }
    // Capture dimensions only. No furniture geometry exists until the camera approaches.
    deferInterior(destination => {
      const previous = add;
      add = destination;
      try { furnishing(...args); } finally { add = previous; }
    });
  };
  const entranceDoor = (roomId: string, x: number, floor: number, z: number, opening: number, height: number, primary: boolean) => {
    const open = primary && ['winter-glasshouse', 'civic-gallery', 'public-station'].includes(building.family);
    const part = (role: string, width: number, tall: number, depth: number, px: number, py: number, pz: number, finish: CityFinish, yaw = 0) => {
      const geometry = new BoxGeometry(width, tall, depth);
      geometry.userData.entranceDoor = { building: building.id, room: roomId, role, primary, opening, floor, x, z, height, open };
      add(geometry, finish, px, py, pz, 1, 1, 1, yaw);
    };
    for (const side of [-1, 1]) part('jamb', .07, height + .05, .15, x + side * (opening / 2 + .02), floor + height / 2, z + .018, 'aqua');
    part('head', opening + .11, .075, .17, x, floor + height + .025, z + .018, 'aqua');
    part('threshold', opening + .12, .025, .25, x, floor + .0125, z + .055, 'metal');
    // Public lobbies welcome visitors; residential and terrace doors rest closed.
    // Glazed leaves retain views into furnished rooms behind their cedar panels.
    const yaw = open ? 110 * Math.PI / 180 : 0, leafWidth = opening - .045, hinge = x + opening / 2;
    const leaf = (role: string, width: number, tall: number, depth: number, offset: number, py: number, finish: CityFinish, face = 0) => {
      part(role, width, tall, depth, hinge + offset * Math.cos(yaw) + face * Math.sin(yaw), py, z - offset * Math.sin(yaw) + face * Math.cos(yaw), finish, yaw);
    };
    leaf('glazing', leafWidth - .075, height - .32, .025, -leafWidth / 2, floor + height / 2 + .075, 'glass');
    for (const offset of [-.022, -leafWidth + .022]) leaf('leaf-stile', .044, height - .025, .052, offset, floor + height / 2, 'aqua');
    for (const py of [floor + .11, floor + height - .027]) leaf('leaf-rail', leafWidth, .055, .06, -leafWidth / 2, py, 'aqua');
    leaf('kick-panel', leafWidth - .065, .20, .04, -leafWidth / 2, floor + .11, 'wood');
    leaf('pull', .03, .22, .035, -leafWidth + .095, floor + height * .49, 'porcelain', .068);
    for (const py of [floor + height * .49 - .085, floor + height * .49 + .085]) leaf('pull-bracket', .03, .027, .07, -leafWidth + .095, py, 'metal', .035);
    for (const py of [floor + .18, floor + height - .18]) part('hinge', .042, .085, .062, hinge, py, z + .022, 'metal');
    if (primary) {
      part('canopy', opening + .28, .075, .64, x, floor + height + .115, z + .225, 'aqua');
      for (const side of [-1, 1]) part('canopy-bracket', .045, .16, .35, x + side * (opening / 2 + .02), floor + height + .015, z + .12, 'metal');
      part('entry-light', .26, .025, .065, x, floor + height + .068, z + .31, 'porcelain');
    }
  };
  const room = (x: number, y: number, z: number, width: number, depth: number, height: number, variant: number, _furnish = true, balcony = false) => {
    const roomId = `${building.id}-room-${roomIndex++}`;
    const floor = y + .13, rear = z-depth/2+.055, front=z+depth/2;
    const opening=Math.min(.74,width-.26), doorHeight=Math.min(1.45,height-.22);
    const innerWidth=width-(glazed?.178:.22);
    const slabGeometry=floorSlab(roomId,[floorRectangle(x,z+.0405,innerWidth,depth-.139)],floor,.13);
    slabGeometry.userData.roomAccess={room:roomId,building:building.id,floor,front:[x,front],rear:[x,rear],opening,height:doorHeight};
    add(slabGeometry,'wood');
    if(y<.21)foundationPolygons.push(floorRectangle(x,z+.02,width+.02,depth+.08));
    sideFaces.push({x,y,z,width,depth,height,room:roomId});
    const wall=(role:string,cx:number,cy:number,cz:number,ww:number,hh:number,dd:number,finish:CityFinish)=>{
      if(ww<=0 || hh<=0 || dd<=0)return;
      const geometry=new BoxGeometry(ww,hh,dd);geometry.userData.roomWall={room:roomId,role,ground:y<.21};add(geometry,finish,cx,cy,cz);
    };
    // Back doors and glazing are actual openings in the shell, not panels pasted onto a wall.
    const wing=(width-opening)/2;
    for(const side of [-1,1]) {
      wall(side<0?'back-left':'back-right',x+side*(opening+wing)/2,y+height/2,rear,wing,height,.11,cladding);
      box(x+side*opening/2,floor+doorHeight/2,rear,.035,doorHeight,.13,'metal');
    }
    wall('back-lintel',x,floor+doorHeight+(height-.13-doorHeight)/2,rear,opening,height-.13-doorHeight,.11,cladding);
    // Open door leaf folds against its jamb and leaves a physically clear route.
    box(x-opening/2+.025,floor+doorHeight/2,rear+.20,.022,doorHeight-.04,.38,'glass');
    box(x-opening/2+.05,floor+.70,rear+.30,.025,.13,.025,'metal');
    access.push({room:roomId,x,back:rear+.065,floor,height:doorHeight});
    if(y<.21)fronts.push({x,z:front,width,floor});
    // Corner posts bind the curtain wall to continuous, inset mineral or cedar end piers.
    for(const side of [-1,1]) {
      const sx=x+side*(width/2-.055);
      const sideFinish:CityFinish=glazed?'window':cladding;
      wall(side<0?'left':'right',glazed?x+side*(width/2-.08):sx,y+height/2,z,glazed?.018:.11,height,depth-.11,sideFinish);
      for(const end of [-1,1])box(sx,y+height/2,z+end*(depth/2-.055),.11,height,.11,'metal');
      if(glazed) {
        box(sx,y+height*.48,z,.14,.055,depth-.12,'metal');
        for(const dz of [-.27,.27])box(sx,y+height/2,z+dz*depth,.13,height,.055,'metal');
      } else {
        // A continuous ventilated rainscreen avoids alternating pasted-on color bands.
        for(let slat=0;slat<Math.floor(depth/.18);slat++)box(sx+side*.065,y+height/2,z-depth*.42+slat*.18,.04,height-.12,.025,'wood');
      }
    }
    wall('front-lintel',x,y+height-.065,front,width,.13,.10,'aqua');
    // All front entrances and planted terraces have their own clear doorway.
    const frontDoor=y<.21 || balcony;
    if(frontDoor) {
      for(const side of [-1,1]) {
        wall('front',x+side*(opening+wing)/2,floor+(height-.26)/2,front-.02,wing-.025,height-.26,.018,'window');
      }
      wall('door-transom',x,floor+doorHeight+(height-.13-doorHeight)/2,front-.02,opening,height-.13-doorHeight,.018,'window');
      entranceDoor(roomId, x, floor, front, opening, doorHeight, y < .21);
    } else {
      wall('front',x,floor+(height-.26)/2,front-.02,width-.12,height-.26,.018,'window');
      box(x,floor+(height-.26)/2,front,.045,height-.26,.065,'metal');
    }
    furnishRoom(x,floor+.015,z,width-.24,depth-.24,_furnish?variant:variant+2,height-.14);
    const viewX=x-(width+opening)*.25;
    roomViews.push({building:building.id,window:[viewX,y+.86,front+.018],target:[viewX,y+.70,z],floor,width:width-.24,height,depth:depth-.24});
    if(balcony) {
      const balconyDepth=.72;
      add(floorSlab(`${roomId}-balcony`,[floorRectangle(x,front+balconyDepth/2-.015,width+.03,balconyDepth+.03)],floor,.13,'balcony'),'stone');
      if (y < .21) {
        const clear = opening + .16, railWidth = (width - clear) / 2;
        for (const side of [-1, 1]) {
          const center = x + side * (clear + railWidth) / 2;
          box(center, floor + .72, front + balconyDepth - .025, railWidth, .045, .045, 'metal');
          box(center, floor + .36, front + balconyDepth - .025, railWidth - .035, .65, .014, 'glass');
          box(x + side * clear / 2, floor + .36, front + balconyDepth - .025, .035, .72, .045, 'metal');
        }
      } else {
        box(x,floor+.72,front+balconyDepth-.025,width,.045,.045,'metal');
        box(x,floor+.36,front+balconyDepth-.025,width-.1,.65,.014,'glass');
      }
      for(const side of [-1,1]) {
        box(x+side*(width/2-.045),floor+.36,front+balconyDepth/2,.035,.72,balconyDepth,'metal');
        const bedWidth=Math.min(.36,width*.18),px=x+side*(width/2-bedWidth/2-.06);
        const planter=cityRoundedBox(bedWidth,.23,.40,.05);planter.userData.reachableGarden={room:roomId,floor};
        add(planter,'aqua',px,floor,front+.31);
        plant(px,floor+.22,front+.31,.55);
      }
    }
  };
  const roof = (x: number, y: number, z: number, width: number, depth: number, planted = false) => {
    slab(x, y, z, width + .08, depth + .08, 'porcelain');
    for(const side of [-1,1]) { box(x+side*width*.49,y+.13,z,.055,.18,depth,'metal'); box(x,y+.13,z+side*depth*.49,width,.18,.055,'metal'); }
    box(x+width*.36,y+.13,z-depth*.35,.16,.22,.16,'metal');
    if (planted) box(x,y+.17,z,width*.7,.07,.07,'aqua');
  };
  const gable = (x: number, y: number, z: number, width: number, depth: number, rise: number, glass = false) => {
    if (glass) for (const side of [-1, 1]) {
      const cap = new BufferGeometry(); cap.setAttribute('position', new Float32BufferAttribute([-width / 2, 0, 0, width / 2, 0, 0, 0, rise, 0], 3)); cap.computeVertexNormals();
      add(cap, 'window', x, y, z + side * depth / 2);
    }
    box(x, y + rise, z, .075, .08, depth + .08, 'metal');
    for (const side of [-1, 1]) {
      const geometry = new BoxGeometry(Math.hypot(width / 2, rise), .075, depth + .1).rotateZ(side * Math.atan2(rise, width / 2));
      add(geometry, glass ? 'window' : 'wood', x - side * width / 4, y + rise / 2, z);
      for (const dz of [-depth / 2, 0, depth / 2]) add(new BoxGeometry(Math.hypot(width / 2, rise), .09, .08).rotateZ(side * Math.atan2(rise, width / 2)), 'metal', x - side * width / 4, y + rise / 2 + .05, z + dz);
    }
  };
  if (family === 'terraced-apartments') {
    const pitch = (h - .55) / 5;
    for (let n = 0; n < 5; n++) { const width = w - n * .38; const x = -n * .105; room(x, .2 + n * pitch, -.18, width, d - .55, pitch, n, n < 2, true); if (n === 4) roof(x, .2 + (n + 1) * pitch + .02, -.18, width, d - .55); }
  } else if (family === 'narrow-mixed-use') {
    const width = w * .54; const pitch = (h - .55) / 6;
    room(0, .2, 0, w - .2, d - .3, pitch, 0, true);
    for (let n = 1; n < 6; n++) room(0, .2 + n * pitch, -.15, width, d - .5, pitch, n, n === 1, n % 2 === 0);
    roof(0, h - .35, -.15, width + .15, d - .45);
    for (const side of [-1, 1]) box(side * (width / 2 + .06), h / 2, -.65, .13, h - .6, .23, 'aqua');
    for (const side of [-1, 1]) roof(side * (w + width) / 4, pitch + .2, 0, (w - width) / 2 - .16, d - .25, true);
  } else if (family === 'split-wings') {
    for (const side of [-1, 1]) { const count = side < 0 ? 5 : 4; const pitch = (h - .5) / 5; for (let n = 0; n < count; n++) room(side * w * .265, .2 + n * pitch, side < 0 ? -.2 : .1, w * .44, d - .6, pitch, n + (side > 0 ? 1 : 0), n < 2); roof(side * w * .265, .2 + count * pitch, side < 0 ? -.2 : .1, w * .45, d - .6); }
    // Every wing is joined by the enclosed rear circulation gallery below.
  } else if (family === 'rounded-housing') {
    const pitch = (h - .6) / 4;
    for (let n = 0; n < 4; n++) {
      const y = .2 + n * pitch; const rx = w / 2 - n * .08; const rz = d / 2 - .23;
      const roomId=`${building.id}-room-${roomIndex++}`;
      const floor=y+.14, roofY=y+pitch, doorHeight=Math.min(1.42,pitch-.22), radiusX=rx-.1,radiusZ=rz-.1;
      const rearCut=-rz+.19;
      const curvedPolygon=floorEllipse(0,0,radiusX,radiusZ,128).map(([px,pz])=>[px,Math.max(pz,rearCut)] as const);
      const curvedFloor=floorSlab(roomId,[curvedPolygon],floor,.14);
      curvedFloor.userData.roomAccess={room:roomId,building:building.id,floor,front:[0,radiusZ],rear:[0,-rz+.1],opening:.62,height:doorHeight};
      add(curvedFloor,'wood');
      const frontAngle=n===0?Math.asin(.405/radiusX):0,backAngle=Math.asin(.345/radiusX);
      const curvedPane=(start:number,length:number,bottom:number,top:number)=>{
        // Share cardinal grid vertices with the floor ellipse so wall and floor edges meet.
        const end=start+length,step=Math.PI*2/128,angles=[start];
        for(let a=Math.ceil((start+1e-8)/step)*step;a<end-1e-8;a+=step)angles.push(a);
        angles.push(end);
        const positions:number[]=[],uv:number[]=[],indices:number[]=[];
        for(const a of angles)for(const level of [-.5,.5]){positions.push(Math.sin(a),level*(top-bottom),Math.cos(a));uv.push((a-start)/length,level+.5);}
        for(let i=0;i<angles.length-1;i++){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
        const glazing=new BufferGeometry();glazing.setAttribute('position',new Float32BufferAttribute(positions,3));glazing.setAttribute('uv',new Float32BufferAttribute(uv,2));glazing.setIndex(indices);glazing.computeVertexNormals();
        glazing.userData.roomWall={room:roomId,role:'ellipse',ground:n===0};
        glazing.userData.cityGlazing={room:roomId,bottom,top,frontClosed:n>0};
        add(glazing,'window',0,(bottom+top)/2,0,radiusX,1,radiusZ);
      };
      curvedPane(frontAngle,Math.PI-backAngle-frontAngle,floor,roofY);
      curvedPane(Math.PI+backAngle,Math.PI-backAngle-frontAngle,floor,roofY);
      // Doors alone interrupt the weather wall; every upper front remains fully glazed.
      curvedPane(Math.PI-backAngle,backAngle*2,floor+doorHeight,roofY);
      if(n===0)curvedPane(-frontAngle,frontAngle*2,floor+doorHeight,roofY);
      const rearJambZ=-radiusZ*Math.cos(backAngle),revealDepth=rearCut-rearJambZ;
      for(const side of [-1,1])box(side*.328,floor+doorHeight/2,rearJambZ+revealDepth/2,.04,doorHeight,revealDepth+.035,'metal');
      box(0,floor+doorHeight+.027,rearJambZ,.7,.055,.08,'metal');
      add(floorSlab(`${roomId}-cornice`,[floorEllipse(0,0,rx,rz,128)],y+pitch+.10,.1,'threshold'),'aqua');
      access.push({room:roomId,x:0,back:rearCut,floor,height:doorHeight});
      if(n===0) {
        fronts.push({x:0,z:radiusZ,width:1.2,floor});
        entranceDoor(roomId,0,floor,radiusZ,.74,doorHeight,true);
        foundationPolygons.push(floorEllipse(0,0,rx-.08,rz-.08,128));
      }
      for(let k=0;k<12;k++) {
        const a=k*Math.PI/6;
        if(Math.abs(Math.sin(a))<.01)continue;
        box(Math.sin(a)*(rx-.075),y+pitch/2,Math.cos(a)*(rz-.075),.065,pitch,.065,'metal');
      }
      sideFaces.push({x:0,y,z:0,width:rx*2,depth:rz*2,height:pitch,room:roomId});
      // Curved residences keep the center aisle clear between front and lift doors.
      furnishRoom(0,y+.15,0,rx*1.65,rz*1.5,n,pitch-.15);
      roomViews.push({building:building.id,window:[-.65,y+.9,Math.sqrt(1-(.65/(rx-.1))**2)*(rz-.1)],target:[-.65,y+.7,0],floor:y+.14,width:rx*1.65,height:pitch,depth:rz*1.5});
    }
    add(new CylinderGeometry(1, 1, .15, 32), 'porcelain', 0, h - .25, 0, w / 2 - .24, 1, d / 2 - .22);
    // Unserved roof remains an unoccupied weather enclosure.
  } else if (family === 'courtyard-block') {
    const pitch = (h - .55) / 3;
    for (let n = 0; n < 3; n++) { for (const side of [-1, 1]) room(side * w * .34, .2 + n * pitch, 0, w * .3, d - .25, pitch, n, n < 2); room(0, .2 + n * pitch, -d * .28, w * .38, d * .38, pitch, n, n === 0); }
    roof(0, h - .35, -.35, w - .1, d * .7); grapeTrellis(0, .2, d * .1, w * .22);
  } else if (family === 'arched-apartments') {
    // A communal maker hall: deep horizontal sunshades, cedar service sides and sawtooth roof.
    const pitch=(h-.8)/3;
    for(let n=0;n<3;n++) {
      const y=.2+n*pitch;
      room(0,y,-.2,w-.2,d-.65,pitch,n,true,true);
      slab(0,y+pitch-.07,d/2-.22,w+.02,.52,'aqua',.08);
      for(const side of [-1,1])box(side*w*.43,y+pitch/2,d/2-.07,.10,pitch,.10,'metal');
    }
    gable(0,h-.65,-.2,w,d-.55,.5,true);
  } else if (family === 'greenhouse-residences') {
    const pitch = (h - 2.7) / 3;
    for (let n = 0; n < 3; n++) room(0, .2 + n * pitch, 0, w - .25, d - .4, pitch, n, n < 2);
    const y = .2 + pitch * 3; room(0, y, 0, w - .55, d - .55, 1.7, 0, true); gable(0, y + 1.7, 0, w - .55, d - .55, .58, true);
    // The top conservatory floor is served by the same lift as the dwellings.
  } else if (family === 'split-level-homes') {
    for (const side of [-1, 1]) { const pitch = side < 0 ? 1.55 : 1.85; for (let n = 0; n < 3; n++) room(side * w * .24, .2 + n * pitch, side < 0 ? .2 : -.2, w * .44, d - .8, pitch, n, n < 2, n === 1); gable(side * w * .24, .2 + 3 * pitch, side < 0 ? .2 : -.2, w * .45, d - .8, .3); }
  } else if (family === 'waterfront-rowhouses') {
    for (let n = 0; n < 3; n++) { const x = (n - 1) * w * .32; room(x, .2, n % 2 ? -.2 : 0, w * .3, d - .55, 2.15, n, true); gable(x, 2.4, n % 2 ? -.2 : 0, w * .31, d - .55, .65 + (n % 2) * .18); }
  } else if (family === 'winter-glasshouse') {
    room(0, .2, 0, w - .35, d - .35, 2.15, 0, true);
    gable(0, 2.35, 0, w - .2, d - .15, .95, true);
    for(const side of [-1,1]) {box(side*w*.36,.35,0,.52,.2,d*.6,'aqua');for(const dz of [-.65,0,.65])plant(side*w*.36,.46,dz,1.2);}
    for (const x of [-w * .33, w * .33]) box(x, 1.25, d / 2 - .15, .07, 2.3, .07, 'metal');
  } else if (family === 'civic-gallery') {
    room(0, .2, -.22, w - .2, d - .55, 2.55, 0, true);
    // Broad cantilever with a raised clerestory stripe makes a low public silhouette.
    roof(0, 2.8, 0, w + .2, d + .1);
    box(-w * .22, 3.05, -.25, w * .44, .25, d * .54, 'window'); slab(-w * .22, 3.16, -.25, w * .49, d * .6, 'porcelain');
    for (const side of [-1, 1]) box(side * w * .42, 1.4, d / 2 - .05, .18, 2.6, .18, 'stone');
  } else if (family === 'stacked-maisonettes') {
    const lowerX=-.28,lowerW=w-.6,lowerD=d-.5,upperX=.25,upperZ=-.25,upperW=w-.7,upperD=d-.8;
    room(lowerX,.2,0,lowerW,lowerD,1.5,0,true);
    room(upperX,1.7,upperZ,upperW,upperD,1.45,1,true,true);
    const lx0=lowerX-lowerW/2,lx1=lowerX+lowerW/2,lz0=-lowerD/2,lz1=lowerD/2;
    const ux0=upperX-upperW/2,ux1=upperX+upperW/2,uz0=upperZ-upperD/2,uz1=upperZ+upperD/2;
    const exposed:FloorPolygon[]=[];
    if(ux0>lx0)exposed.push(floorRectangle((lx0+ux0)/2,0,ux0-lx0,lowerD));
    if(lx1>ux1)exposed.push(floorRectangle((ux1+lx1)/2,0,lx1-ux1,lowerD));
    const commonLeft=Math.max(lx0,ux0),commonRight=Math.min(lx1,ux1);
    if(uz0>lz0)exposed.push(floorRectangle((commonLeft+commonRight)/2,(lz0+uz0)/2,commonRight-commonLeft,uz0-lz0));
    if(lz1>uz1)exposed.push(floorRectangle((commonLeft+commonRight)/2,(uz1+lz1)/2,commonRight-commonLeft,lz1-uz1));
    const lowerRoof=floorSlab(`${building.id}-exposed-lower-roof`,exposed,1.83,.13,'balcony');
    lowerRoof.userData.structuralSupport={role:'weather-roof'};add(lowerRoof,'porcelain');
    // Transfer beams bear on the lower side walls and carry the offset upper wall.
    for(const z of [uz0+.07,uz1-.07]) {
      const beam=new BoxGeometry(upperW+.36,.20,.16);beam.userData.structuralSupport={role:'transfer-beam'};
      add(beam,'metal',upperX,1.70,z);
      const postX=ux1-.065,post=new BoxGeometry(.13,1.6,.13);post.userData.structuralSupport={role:'column'};
      add(post,'metal',postX,.8,z);
      foundationPolygons.push(floorRectangle(postX,z,.22,.22));
    }
    roof(upperX,3.17,upperZ,w-.65,d-.75);
  } else {
    // Ground lobby is a furnished open-front room; the upper boarding path remains clear.
    room(-.82, .2, 0, 1.25, d - .35, 1.78, 0, true);
    add(floorSlab('station-lobby-threshold',[floorRectangle(-.82,d/2-.27,1.05,.6)],.33,.33,'threshold'),'stone');
    // Twin platforms leave the guideway and undercarriage a real central slot.
    const platform = floorSlab('station-boarding-platform', [floorRectangle((-w / 2 - 1.12) / 2, 0, w / 2 - 1.12, 1.2), floorRectangle((w / 2 + .58) / 2, 0, w / 2 - .58, d)], 2.32, .18, 'threshold');
    platform.userData.floor.kind = 'platform';
    add(platform, 'stone');
    // Rear posts tuck between the curved arrivals; the roof cantilevers over the track ends.
    for (const side of [-1, 1]) for (const z of side < 0 ? [-.38, .38] : [-d * .43, d * .43]) {
      const x = side * w * .44;
      box(x, 1.07, z, .12, 2.14, .12, 'metal');
      box(x, 3.32, z, .12, 2.1, .12, 'metal');
      foundationPolygons.push(floorRectangle(x, z, .16, .16));
    }
    // Barrel canopy opens both rail ends and the pedestrian side entrance.
    const shape = new Shape(); shape.moveTo(-w / 2, 0); shape.quadraticCurveTo(0, .74, w / 2, 0); shape.lineTo(w / 2, -.08); shape.quadraticCurveTo(0, .65, -w / 2, -.08); shape.closePath();
    add(new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 14 }), 'porcelain', 0, 4.34, -d / 2);
    box(-w * .42, 2.83, 0, .28, .25, .58, 'wood');
    for (const z of [-.20, .20]) box(-w * .42, 2.57, z, .08, .43, .08, 'metal');
    // Top landing is kept open around local [1.6, 2.32, 0].
    for (const z of [-d / 2 + .05, d / 2 - .05]) box(w * .38, 2.72, z, w * .18, .065, .065, 'metal');
  }
  if(family!=='public-station'&&sideFaces.length) {
    for(const side of [-1,1]) {
      const ground=sideFaces.filter(face=>face.y<.21).sort((a,b)=>side*(b.x+side*b.width/2-a.x-side*a.width/2))[0];
      const seed=[...building.id].reduce((value,letter)=>(value*31+letter.charCodeAt(0))%65521,17)+(side>0?7:2),height=Math.min(h-.5,(.64+(seed%4)*.065)*h);
      const width=Math.min(.8,ground.depth*(.19+(seed%3)*.035));
      const garden=createFacadeGarden({width,height,seed});
      const z=ground.z-ground.depth*.22;
      const surfaceX=(face:typeof ground,pz:number)=>family==='rounded-housing'
        ? face.x+side*((face.width/2)*Math.sqrt(Math.max(0,1-((pz-face.z)/(face.depth/2))**2))+.05)
        : face.x+side*(face.width/2+.08);
      const baseX=surfaceX(ground,z)+side*.04;
      for(const [part,geometry]of Object.entries(garden)) {
        if(!geometry.getAttribute('position')?.count){geometry.dispose();continue;}
        geometry.rotateY(side*Math.PI/2);
        // Carry the stem around shallow floor setbacks instead of suspending it off the facade.
        const p=geometry.getAttribute('position');
        for(let i=0;i<p.count;i++) {
          const level=Math.max(0,p.getY(i));p.setY(i,level);
          const candidates=sideFaces.filter(face=>level>=face.y-.15&&level<=face.y+face.height+.15);
          const face=candidates.sort((a,b)=>side*(b.x+side*b.width/2-a.x-side*a.width/2))[0]??ground;
          const desired=surfaceX(face,z+p.getZ(i)),blend=Math.min(1,Math.max(0,level/.6));
          p.setX(i,p.getX(i)+(desired-baseX)*blend);
        }
        geometry.computeVertexNormals();
        geometry.userData.facadeGarden={building:building.id,role:part,floor:0,root:[baseX,0,z],seed,width,height};
        const finish:CityFinish=part==='planter'?'stone':part==='wood'?'wood':part==='trellis'?'metal':'garden';
        add(geometry,finish,baseX,0,z);
      }
    }
  }
  if (family !== 'public-station') {
    const entrance = cityEntrances.find(item => item.building === building.id)!.local;
    const thresholds:FloorPolygon[]=[];
    for (const front of fronts) {
      const opening = Math.min(.86, front.width - .3);
      const porchDepth = Math.max(.45, entrance[2] - front.z + .12);
      thresholds.push(floorRectangle(front.x,front.z+porchDepth/2-.03,opening+.22,porchDepth));
    }
    if(fronts.length>1) {
      const start=Math.max(...fronts.map(front=>front.z-.03)),end=entrance[2]+.12;
      thresholds.push(floorRectangle(0,(start+end)/2,w-.08,end-start));
    }
    if(thresholds.length)add(floorSlab(`${building.id}-entry-porch`,thresholds,fronts[0].floor,.13,'threshold'),'stone');
  }
  if (access.length) {
    const coreX = 0, coreZ = -d / 2 - .68;
    const floors = [...new Set(access.map(room => Number(room.floor.toFixed(5))))].sort((a,b) => a-b);
    const top = Math.max(...access.map(room => room.floor + room.height)) + .12;
    if (floors.length > 1) {
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) box(coreX + side * .43, top / 2, coreZ + end * .44, .055, top, .055, 'metal');
        box(coreX + side * .39, top / 2, coreZ, .018, top, .78, 'glass');
        box(coreX + side * .31, top / 2, coreZ - .35, .04, top, .04, 'metal');
      }
      box(coreX, top / 2, coreZ - .44, .85, top, .018, 'glass');
      for(const floor of floors) {
        const polygons=[floorRectangle(0,coreZ+.34,.78,.34)];
        for(const room of access.filter(room=>Math.abs(room.floor-floor)<.00001)) {
          const front=coreZ+.46,length=room.back-front;
          if(length>0)polygons.push(floorRectangle(room.x,front+length/2,.78,length));
          if(Math.abs(room.x)>.02)polygons.push(floorRectangle(room.x/2,front+.24,Math.abs(room.x)+.78,.52));
        }
        // One unioned walking surface prevents coincident landings for shared stops.
        const landing=floorSlab(`${building.id}-lift-landing-${floor}`,polygons,floor,.09,'threshold');
        landing.userData.liftLanding={building:building.id,floor};add(landing,'stone');
        const served=access.filter(room=>Math.abs(room.floor-floor)<.00001),front=coreZ+.46;
        const corridorHeight=Math.min(...served.map(room=>room.height));
        const cover=floorSlab(`${building.id}-corridor-cover-${floor}`,polygons,floor+corridorHeight+.09,.07,'threshold');
        cover.userData.circulation={building:building.id,floor,rooms:served.map(room=>room.room)};add(cover,'aqua');
        for(const room of served) {
          const length=room.back-front;
          if(length>0)for(const side of [-1,1]) {
            // Glazed corridor returns run to the actual rear jamb, clear of the transverse gallery.
            const start=front+(Math.abs(room.x)>.02?.50:0),span=room.back-start;
            if(span>0) {
              box(room.x+side*.38,floor+corridorHeight/2,start+span/2,.018,corridorHeight,span,'glass');
              for(const end of [start,room.back])box(room.x+side*.38,floor+corridorHeight/2,end,.035,corridorHeight,.035,'metal');
            }
          }
        }
        const minX=Math.min(0,...served.map(room=>room.x))-.39,maxX=Math.max(0,...served.map(room=>room.x))+.39;
        for(const side of [-1,1]) {
          const lo=side<0?minX:.43,hi=side<0?-.43:maxX;
          if(hi>lo)box((lo+hi)/2,floor+corridorHeight/2,front+.01,hi-lo,corridorHeight,.018,'glass');
        }


      }
      slab(0, top, coreZ, 1.03, 1.07, 'porcelain');
      box(0, top + .18, coreZ, .52, .24, .45, 'metal');
      onLift?.({ building: building.id, x: coreX, z: coreZ, floors, top });
    }
  }
  add(floorSlab(`${building.id}-foundation`,foundationPolygons,.2,.2,'foundation'),'stone');
  return roomViews;
}
