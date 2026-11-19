# 261117 Web Animations API (WAAPI) 기술 해설

> 한 줄 요약 · 웹 브라우저의 애니메이션을 명령형으로 제어하는 표준 API입니다. · 분야: DOM · 렌더링 · Baseline: Widely available: 현대적인 모든 주요 브라우저에서 지원합니다. [2] · 읽는 시간 약 6분

## 1. 왜 쓰는가
CSS 애니메이션은 선언적 방식으로 동작하여 단순한 인터랙션에는 효율적이지만, 애니메이션의 중단, 역재생, 동적 속도 조절 등 명령형 제어가 필요한 복잡한 상황에서는 한계가 있습니다. JavaScript로 직접 DOM 스타일을 조작하여 해결할 수도 있으나, 이는 브라우저의 렌더링 최적화 기회를 놓쳐 성능 저하를 유발할 수 있습니다. WAAPI는 CSS 애니메이션이 가지는 브라우저 엔진 수준의 최적화 이점을 누리면서도, JavaScript를 통해 애니메이션을 완벽하게 제어할 수 있는 표준 인터페이스를 제공하기 위해 등장했습니다 [1][2].

## 2. 핵심 개념
WAAPI의 중심에는 `Animation`과 `KeyframeEffect`가 있습니다. `KeyframeEffect`는 애니메이션이 적용될 대상과 키프레임, 타이밍 옵션을 정의하며, `Animation` 인터페이스는 생성된 효과를 실제로 제어하는 역할을 합니다 [4][5].

![WAAPI 핵심 구조](/Users/kh1012/.gemini/antigravity-cli/brain/b9351055-9a16-46b4-83bc-a52e90247681/assets/concept-structure.svg)

## 3. 동작 원리
WAAPI는 CSS와 동일한 브라우저 엔진 아키텍처를 공유하여 컴포지터 스레드에서 하드웨어 가속을 수행합니다 [3]. `play()` 호출 시 애니메이션이 타임라인에 등록되고, 브라우저는 렌더링 루프마다 현재 시간을 기반으로 상태를 계산하여 화면을 업데이트합니다.

```diagram
@align center
@dir right

[JavaScript]
[KeyframeEffect]
[Animation Object]
[Browser Engine (Compositor)]
[Display]

JavaScript -> KeyframeEffect : .animate()
KeyframeEffect -> Animation Object : create
Animation Object -> Browser Engine (Compositor) : .play()
Browser Engine (Compositor) -> Display : Render
```

## 4. 기본 사용법
`element.animate()` 메서드를 사용하여 애니메이션을 생성하고 즉시 실행할 수 있습니다.

```js
const element = document.querySelector('.box');
const animation = element.animate([
  { transform: 'translateX(0px)', opacity: 0 },
  { transform: 'translateX(300px)', opacity: 1 }
], {
  duration: 1000,
  iterations: Infinity
});
```

*   `element.animate()`: 애니메이션을 즉시 생성하고 실행하며, `Animation` 객체를 반환합니다.
*   첫 번째 인자: 키프레임 배열로, 애니메이션의 상태 변화를 정의합니다.
*   두 번째 인자: 타이밍 옵션 객체로, 지속 시간(`duration`)이나 반복 횟수(`iterations`) 등을 설정합니다.

## 5. 실무 예시

### 명령형 상태 제어
애니메이션을 일시 정지하거나 다시 시작해야 하는 상황에서 유용합니다.

```js
const anim = element.animate(keyframes, { duration: 2000 });
// 필요 시 제어
anim.pause();
anim.play();
```
주의점: 상태 제어 시점에 따라 애니메이션의 `currentTime`이 변경될 수 있음을 고려해야 합니다 [5].

### 순차적 시퀀싱
애니메이션이 완료된 후 다음 작업을 수행할 때 `finished` 프로미스를 활용합니다.

```js
element.animate(keyframes, { duration: 1000 }).finished.then(() => {
  console.log('애니메이션 종료');
  // 후속 작업 수행
});
```
주의점: 애니메이션이 취소(`cancel`)될 경우 프로미스는 거부(reject)될 수 있습니다 [6].

## 6. 장점 · 단점

| 장점 | 단점 |
| :--- | :--- |
| 완벽한 프로그래밍 제어 [2] | 물리 효과(스프링) 내장 부재 |
| 브라우저 네이티브 컴포지터 스레드 활용 [2] | 복잡한 시퀀싱 시 코드 복잡도 증가 |
| Promise 기반의 깔끔한 시퀀싱 [2] | 일부 속성 보간 제한 |

## 7. 한계와 함정
WAAPI는 네이티브 물리 효과를 내장하고 있지 않아, 자연스러운 스프링 애니메이션 구현을 위해서는 별도의 라이브러리가 필요할 수 있습니다 [2]. 또한, 복잡한 키프레임 보간 과정에서 브라우저의 레이아웃 비용이 발생하여 성능 저하를 유발할 수 있으므로, 하드웨어 가속이 가능한 `transform`이나 `opacity` 속성 위주로 사용하는 것이 좋습니다 [3][6].

## 8. 다른 방법과 비교

| 방법 | 언제 | 비용 | 한계 |
| :--- | :--- | :--- | :--- |
| CSS Animations | 단순 반복, 상태 고정 | 낮음 | 명령형 제어 불가 |
| WAAPI | 명령형 제어, 복잡한 시퀀스 | 보통 | 라이브러리 대비 물리 효과 부족 |
| JS 직접 조작 | 정교한 물리 기반 애니메이션 | 높음 | 성능 최적화 어려움 |

명령형 제어가 필요 없거나 CSS만으로 충분한 경우에는 CSS Animations가 더 나은 선택일 수 있습니다.

## 9. 대비와 새로운 시도
WAAPI는 CSS 애니메이션의 내부 동작을 표준화한 API로, 브라우저 엔진에서 최적화된 상태로 실행됩니다 [1][3]. 현재는 표준이 널리 지원되고 있으며, 복잡한 물리 효과를 위해서는 Web Animations API를 기반으로 하는 라이브러리(`Motion`, `GSAP` 등)와의 연동이 일반적입니다.

## 10. 다른 사람에게 설명하기
WAAPI는 CSS 애니메이션의 성능을 유지하면서 JavaScript를 통해 애니메이션의 재생, 정지, 순차적 제어를 가능하게 하는 표준 인터페이스입니다. 이를 통해 복잡한 인터랙션 구현 시 성능과 제어력 사이의 균형을 맞출 수 있습니다.

질문 확인:
*   CSS 애니메이션과 비교했을 때 WAAPI가 가지는 가장 큰 제어 측면의 장점은 무엇인가?
*   `Animation` 객체의 `finished` 프로미스는 어떤 경우에 유용한가?
*   성능을 위해 WAAPI 사용 시 주로 어떤 속성을 활용해야 하는가?

## 참고 자료
1. [MDN Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
2. [Web Animations API: Bridging the gap](https://exodeui.com/blog/web-animations-api)
3. [CSS Animations vs WAAPI Performance](https://css-tricks.com/web-animations-api)
4. [MDN KeyframeEffect](https://developer.mozilla.org/en-US/docs/Web/API/KeyframeEffect)
5. [MDN Animation Interface](https://developer.mozilla.org/en-US/docs/Web/API/Animation)
6. [MDN Animation finished property](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished)

조사: 2026-11-17

## 내 리뷰
(읽고 느낀 점 · 궁금한 것을 적는다. 질문은 Q. 로 시작)
