<p align="center">
  <h1 align="center">Oh My Agentic Score</h1>
  <p align="center">
    <strong>에이전틱 코딩 성능을 측정하고 시각화하세요</strong>
  </p>
  <p align="center">
    <a href="https://www.youtube.com/@indydevdan">IndyDevDan</a>의 Thread-Based Engineering 프레임워크 기반
  </p>
  <p align="center">
    <a href="https://pypi.org/project/oh-my-agentic-score/"><img src="https://img.shields.io/pypi/v/oh-my-agentic-score?color=blue" alt="PyPI"></a>
    <a href="https://github.com/HwangTaehyun/oh-my-agentic-score/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/python-3.11+-blue" alt="Python"></a>
  </p>
</p>

---

> *"측정할 수 없으면 개선할 수 없다."*

AI와 함께 개발하는 시대, **에이전틱 코딩** — AI 에이전트와 효과적으로 협업하는 능력 — 은 이제 모든 개발자에게 필수적인 역량이 되고 있습니다. 하지만 내가 실제로 얼마나 잘하고 있는지 어떻게 알 수 있을까요? **측정하지 못하면 발전시킬 수도 없습니다.**

**Oh My Agentic Score (OMAS)** 는 이 믿음에서 시작되었습니다. [IndyDevDan](https://www.youtube.com/@indydevdan)의 [Thread-Based Engineering](https://www.youtube.com/@indydevdan) 프레임워크에 깊은 영감을 받아, 에이전틱 코딩 능력을 구체적이고 데이터 기반으로 측정하고 시각화할 수 있는 도구를 만들었습니다.

OMAS는 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 세션 로그를 분석하여 **병렬성**, **자율성**, **밀도**, **신뢰도** 4가지 차원으로 성능을 측정합니다. 기본 대화에서 완전 자율 Z-thread까지, 자신의 성장 과정을 추적하고 더 나은 에이전틱 개발자로 나아가세요.

## 설치

### 원라인 설치 (권장)

```bash
curl -fsSL https://raw.githubusercontent.com/HwangTaehyun/oh-my-agentic-score/main/install.sh | bash
```

### Homebrew (macOS)

```bash
brew install HwangTaehyun/tap/oh-my-agentic-score
```

### pip / uv

```bash
pip install oh-my-agentic-score

# 또는 uv 사용 (더 빠름)
uv tool install oh-my-agentic-score
```

## 빠른 시작

```bash
# 모든 Claude Code 세션 스캔
omas scan

# 리포트 보기
omas report

# 인터랙티브 대시보드 실행
omas dashboard
```

## 주요 기능

### 4차원 점수 체계 (0-10)

| 차원 | 스레드 | 측정 내용 |
|------|--------|-----------|
| **More** | P-thread | 병렬 실행 경로 (동시 서브에이전트 수) |
| **Longer** | L-thread | 인간 개입 없는 자율 작업 시간 |
| **Thicker** | B-thread | 작업 밀도 (서브에이전트 깊이, 분당 tool call) |
| **Fewer** | Z-thread | 인간 체크포인트 감소 (신뢰 수준) |

### 7가지 스레드 유형

세션은 우선순위에 따라 하나의 유형으로 분류됩니다:

```
Z-thread  제로터치    최소 인간 입력, 최대 자율 작업
B-thread  빅          중첩 서브에이전트 (에이전트가 에이전트 생성)
L-thread  롱          30분+ 자율 실행, 50+ tool calls
F-thread  퓨전        유사 작업을 여러 에이전트에 분배
P-thread  패럴렐      2+ 동시 에이전트 실행
C-thread  체인드      여러 인간 체크포인트 + 각 사이 작업
Base      기본        일반 대화
```

### CLI 명령어

```bash
omas scan                    # 전체 세션 스캔 → DB
omas analyze <session-id>    # 단일 세션 분석
omas report                  # 전체 리포트 (비교 메트릭 포함)
omas trend                   # 시간별 트렌드
omas export                  # JSON 내보내기
omas dashboard               # Next.js 대시보드 실행
omas list                    # 발견된 세션 목록
omas tui                     # 인터랙티브 TUI (Trogon)
omas auth login              # OAuth 로그인 (GitHub/Google)
omas auth status             # 인증 상태 확인
omas upload --dry-run        # 클라우드 업로드 미리보기
```

### Next.js 대시보드

인터랙티브 웹 대시보드:
- 4차원 레이더 차트
- 스레드 유형 분포 파이 차트
- 시간별 점수 트렌드
- 프로젝트별 분석
- 세션 상세 보기

### 공정 비교 시스템

짧은 테스트 세션이 점수를 왜곡하지 않도록:

- **최소 기준**: 5분+ 시간, 10+ tool calls, 1+ human message
- **가중 점수**: 길고 복잡한 세션에 더 큰 가중치
- **일관성 점수**: 최근 세션들의 점수 안정성 측정
- **종합 순위**: `가중_점수 * 0.8 + 일관성 * 0.2`

## 아키텍처

```
Claude Code JSONL 로그 (~/.claude/projects/)
        │
        ▼
   omas scan          모든 세션 파싱 및 분석
        │
        ├─► SQLite DB (~/.omas/metrics.db)     로컬 저장 (항상)
        │
        ├─► metrics.json                        대시보드 데이터
        │
        └─► 클라우드 업로드 (선택)                백그라운드 동기화
             └─► upload_queue.json              실패 시 재시도 큐
```

### Offline-First 설계

- 분석 결과는 항상 로컬 SQLite에 먼저 저장
- 클라우드 업로드는 자동이지만 선택적
- 네트워크 실패 시 재시도 큐에 저장 (최대 5회)
- 대시보드는 로컬 데이터만으로 완전 동작

### 개인정보 보호

- 프로젝트 경로는 **해시** 처리 후 전송 (디렉토리명 비노출)
- 세션 ID는 중복 방지 목적으로만 유지
- **소스 코드나 파일 내용은 절대 전송하지 않음**

## 점수 향상 가이드

```
Base → C-thread    3턴 이상 대화, 각 턴 사이 작업 수행
C    → P-thread    병렬 작업 요청 ("이 3개 파일 동시에 분석해줘")
P    → L-thread    상세한 지시, 30분 이상 자율 실행 유도
L    → B-thread    팀/워크트리로 깊은 서브에이전트 계층 구조
B    → Z-thread    하나의 명령, 전체 기능 구현, 자동 승인
```

핵심 팁:
- 프로젝트 컨벤션을 상세히 담은 `CLAUDE.md` 작성
- 점진적 지시 대신 완전한 요구사항을 한 번에 전달
- Permission 자동 승인으로 중단 방지
- 독립적인 병렬 작업에 Agent tool 활용

## 개발

```bash
git clone https://github.com/HwangTaehyun/oh-my-agentic-score.git
cd oh-my-agentic-score
uv sync
uv run omas --help
```

자세한 개발 환경 설정은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## 크레딧

- **프레임워크**: [IndyDevDan](https://www.youtube.com/@indydevdan)의 Thread-Based Engineering
- **영감**: [oh-my-opencode](https://github.com/nicepkg/oh-my-opencode)
- **TUI**: [Textual](https://textual.textualize.io/) + [Trogon](https://github.com/Textualize/trogon) by Will McGugan

## Tip

### Be with us!

<a href="https://github.com/HwangTaehyun/oh-my-agentic-score/issues"><img src="https://img.shields.io/badge/Issues-버그%20리포트%20%2F%20기능%20건의-green" alt="Issues"></a>&nbsp;&nbsp;버그를 발견하거나 기능 아이디어가 있다면 이슈를 남겨주세요. 모든 피드백을 환영합니다.

<a href="mailto:thbeem94@gmail.com"><img src="https://img.shields.io/badge/Email-thbeem94%40gmail.com-blue" alt="Email"></a>&nbsp;&nbsp;질문, 건의, 협업 제안은 이메일로 연락주세요.

<a href="https://github.com/HwangTaehyun"><img src="https://img.shields.io/github/followers/HwangTaehyun?label=Follow%20%40HwangTaehyun&style=social" alt="GitHub Follow"></a>&nbsp;&nbsp;더 많은 프로젝트를 보려면 [@HwangTaehyun](https://github.com/HwangTaehyun)을 팔로우하세요.

## 라이선스

[MIT](LICENSE) - 황태현 (Taehyun Hwang)
