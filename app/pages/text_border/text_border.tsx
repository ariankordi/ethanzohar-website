import { string } from "three/tsl";

function genString(vChars: String, l: number) {
  let s = "";
  for (let j = 0; j < l; j++) {
    s += vChars[Math.floor(Math.random() * vChars.length)];
  }
  return s;
}

export function TextBorder() {
  // const validCharacters = "8/+_>÷d%¾g";
  const validCharacters = "8g";
  const STRING_LENGTH = 50;
  const MIN_HEIGHT = 1;
  const MAX_HEIGHT = 2;

  const strings = [];
  const renderStringsArray = [];

  for (let i = 0; i < MAX_HEIGHT; i++) {
    renderStringsArray.push([]);
  }

  console.log(renderStringsArray);

  const h = 2;
  strings.push(genString(validCharacters, h));
  
  for (let i = 1; i < STRING_LENGTH; i++) {
    const rand = Math.floor(Math.random() * 100);
    let l: number = strings[i-1].length;

    if (rand < 25) {
      if (l == MIN_HEIGHT) {
        l += 1;
      } else {
        l -= 1;
      }
    } else if (rand > 75) {
      if (l == MAX_HEIGHT) {
        l -= 1;
      } else {
        l += 1;
      }
    }

    const s = genString(validCharacters, l)
    strings.push(s);
  }

  for (let i = 0; i < strings.length; i++) {
    const paddedS = strings[i].padEnd(MAX_HEIGHT, " ");
    for (let j = 0; j < renderStringsArray.length; j++) {
      renderStringsArray[j].push(paddedS[j]);
    }
  }

    console.log({strings})
    console.log({renderStringsArray})

  const renderStrings = renderStringsArray.map((arr) => {
    console.log({arr, s: arr.join("")});
    console.log({length: arr.join("").length});
    return arr.join("");
  });

  console.log({renderStrings})

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div style={{ width: "100vw", fontFamily: "Bitcount Prop Single", whiteSpace: "pre"}}>
      {renderStrings.map((str, i) => (
        <div key={i}>{"A" + str + "B"}</div>
      ))}
      </div>
      <div style={{ width: "100vw", position: "absolute", bottom: 0}}>
      ---
      </div>
    </div>
  );
}

// A88gg8gg88g888ggg8gg888888gg8g8g8gg8ggg88gg88gggg8gB
// Ag8gg   88   8 gg   g 88  gg8  g  8g  g8  g    88  B