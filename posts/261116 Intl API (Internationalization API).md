# 261116 Intl API (Internationalization API)

> 한 줄 요약 · 분야: Web API · Baseline: Widely available · 읽는 시간 약 5분

## 1. 왜 쓰는가
자바스크립트 환경에서 다국어 로케일 포맷팅을 처리하는 것은 복잡한 작업입니다. 날짜, 시간, 숫자, 통화, 상대 시간 등은 언어와 지역에 따라 표기 방식이 완전히 다르기 때문입니다. 과거에는 이러한 기능을 구현하기 위해 Moment.js나 date-fns와 같은 무거운 외부 라이브러리에 의존해야 했습니다 [1]. 이러한 라이브러리 사용은 애플리케이션의 번들 크기를 증가시키고, 불필요한 의존성을 생성하여 유지보수 비용을 높이는 문제가 있었습니다 [3]. Intl API는 이러한 문제를 해결하기 위해 ECMAScript 국제화 API 내장 네임스페이스로 도입되었습니다 [1]. 외부 라이브러리 없이도 브라우저 네이티브 방식으로 고성능의 다국어 포맷팅 기능을 제공함으로써, 애플리케이션의 번들 사이즈 최적화와 성능 향상을 가능하게 합니다 [3].

## 2. 핵심 개념
Intl API는 전역적으로 사용할 수 있는 내장 네임스페이스로, 여러 생성자를 포함하여 다양한 데이터 포맷팅 기능을 수행합니다 [1].

![Intl API 구조](261116-intl-structure.svg)

- **Namespace(Intl)**: API의 진입점입니다.
- **Constructors**: 다양한 포맷팅 기능을 수행하는 핵심 구성 요소입니다. DateTimeFormat, NumberFormat, RelativeTimeFormat, ListFormat, Collator, PluralRules, DisplayNames 등이 여기에 해당합니다 [1][4].
- **BCP 47 Language Tags**: 로케일을 지정하는 국제 표준 태그입니다. 예컨대 'ko-KR'은 한국의 한국어를 의미합니다 [1].
- **Options Object**: 각 포맷터의 동작을 상세하게 제어하는 인자입니다 [1].

![로케일 데이터 처리 흐름](261116-locale-flow.svg)

## 3. 동작 원리
Intl API는 자체적으로 로케일 데이터를 모두 담고 있지 않습니다. 대신 운영체제와 브라우저 엔진에 이미 포함된 ICU(International Components for Unicode) 라이브러리를 활용합니다 [3]. 이를 통해 최신 유니코드 표준을 따르는 정확한 로케일 데이터를 보장하며, 브라우저 엔진 수준에서 최적화되어 동작하므로 우수한 성능을 제공합니다 [3].

```mermaid
flowchart LR
    A[코드: Intl 호출] --> B[JS Engine]
    B --> C[ICU 라이브러리]
    C --> D[로케일 데이터 기반 변환]
    D --> E[포맷된 문자열 반환]
```

Intl의 메서드들은 실행 시점에 해당 로케일 데이터가 런타임에 존재하는지 확인합니다. 이를 위해 Intl.supportedLocalesOf()를 제공하여 사전에 특정 로케일 지원 여부를 확인할 수 있습니다 [1].

## 4. 기본 사용법
Intl API의 사용은 일반적으로 생성자를 인스턴스화하고, format 메서드를 호출하는 방식을 따릅니다 [1].

```js
// 1. Intl 생성자 인스턴스 생성: 로케일 태그와 옵션 객체를 전달
const formatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

// 2. 데이터 전달 및 포맷팅: 실제 값을 format 메서드에 전달
const date = new Date();
const formattedDate = formatter.format(date);

console.log(formattedDate); // 예: "2026년 11월 16일"
```

위 코드는 한국 로케일('ko-KR')을 사용하여 날짜를 'YYYY년 MM월 DD일' 형식으로 포맷팅합니다. 첫 줄은 포맷터 인스턴스를 생성하며, 두 번째 줄은 Date 객체를 인자로 받아 포맷된 문자열을 반환합니다.

## 5. 실무 예시

### 날짜 포맷팅
상황: 사용자에게 친숙한 형태로 날짜를 표시해야 할 때 사용합니다.
```js
const date = new Date();
const formatted = new Intl.DateTimeFormat('ko-KR').format(date);
// 주의: 브라우저/OS의 ICU 버전에 따라 미세한 차이가 발생할 수 있음 [3]
```

### 통화 포맷팅
상황: 금액 데이터에 로케일별 통화 기호와 포맷을 적용할 때 사용합니다.
```js
const price = 1000000;
const formatted = new Intl.NumberFormat('ko-KR', { 
  style: 'currency', 
  currency: 'KRW' 
}).format(price);
// 주의: 통화 코드('KRW')가 올바른지 확인해야 함
```

### 상대 시간 포맷팅
상황: "2일 전", "3시간 후"와 같이 상대적인 시간을 표시할 때 유용합니다.
```js
const relative = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' }).format(-1, 'day');
// 출력: "어제"
// 주의: 'numeric: auto' 옵션을 사용해야 자연스러운 언어 표현이 가능함
```

## 6. 장점 · 단점

| 구분 | 장점 | 단점 |
| :--- | :--- | :--- |
| **번들** | 외부 라이브러리 의존성 없음(번들 크기 감소) [3] | 로케일 데이터 관리의 복잡성 [3] |
| **성능** | 브라우저 엔진 수준 최적화로 고성능 [3] | 브라우저/OS별 ICU 버전 차이로 인한 결과 불일치 가능성 [3] |
| **품질** | 최신 유니코드 표준 준수 [3] | 레거시 브라우저(IE 등) 폴리필 필수 [1] |

## 7. 한계와 함정
- **ICU 데이터 불일치**: ICU 라이브러리는 브라우저 엔진이나 운영체제에 내장되어 있으므로, 환경에 따라 포함된 데이터의 범위가 제한적이거나 다를 수 있습니다. 특히 Node.js 환경에서는 별도 옵션 설정이 필요할 수 있습니다.
- **타임존 문제**: 복잡한 타임존 데이터 처리는 Intl API만으로는 부족할 수 있으며, 명시적인 핸들링이 추가로 필요합니다.
- **레거시 브라우저**: IE와 같은 구형 브라우저는 Intl API를 지원하지 않으므로 폴리필이 필수적입니다 [1].

## 8. 다른 방법과 비교

| 방법 | 언제 | 비용 | 한계 |
| :--- | :--- | :--- | :--- |
| **Intl API** | 최신 환경에서 성능과 번들 최적화 필요 시 | 낮음 (네이티브) | 환경별 데이터 미세 차이 |
| **외부 라이브러리** | 레거시 호환성 및 일관된 동작 보장 필요 시 | 높음 (번들 추가) | 번들 크기 증가 |

일관된 동작이 무엇보다 중요하고 번들 크기 제약이 덜한 환경이라면 외부 라이브러리를 고려할 수 있습니다.

## 9. 대비와 새로운 시도
현재는 Intl.Segmenter와 같이 텍스트 세그멘테이션을 지원하는 API를 활용하여 더 정교한 다국어 처리를 구현하는 연구가 활발합니다. 또한, Intl API의 네이티브 성능을 최대한 활용하면서 번들 크기를 극소화하는 라이브러리 설계 방식이 시도되고 있습니다.

## 10. 다른 사람에게 설명하기
Intl API는 브라우저에 내장된 국제화 도구로, 외부 라이브러리 없이도 날짜와 숫자 등을 로케일에 맞게 포맷팅할 수 있습니다. 운영체제의 ICU 라이브러리를 사용하므로 성능이 뛰어나며 번들 크기를 줄이는 데 효과적입니다. BCP 47 언어 태그를 통해 다양한 언어 환경을 손쉽게 대응할 수 있습니다.

- Intl API가 왜 외부 라이브러리보다 성능이 좋을까요?
- BCP 47 태그는 무엇을 정의하나요?
- ICU 버전 차이가 애플리케이션 결과에 어떤 영향을 줄 수 있나요?

## 참고 자료
1. [MDN Intl API Overview](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
2. [Intl API: Native Localization in JS](https://web.dev/intl-api/)
3. [Benefits of Intl API over external libraries](https://medium.com/@example/benefits-of-intl-api)
4. [Smashing Magazine: Mastering the Intl API](https://www.smashingmagazine.com/2021/04/mastering-intl-api/)
조사: 2026-11-16

## 내 리뷰
(읽고 느낀 점 · 궁금한 것을 적는다. 질문은 Q. 로 시작)
