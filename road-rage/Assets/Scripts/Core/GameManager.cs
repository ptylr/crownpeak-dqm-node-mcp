using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Central game controller. Manages the 60-second timer, scoring, and game state.
/// Points are displayed as cakes and coffees in the UI.
/// </summary>
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("Game Settings")]
    public float gameDuration = 60f;

    [Header("Scoring")]
    public int pointsPerZombie = 1;
    public int comboBonus = 3;          // Bonus points when 3+ zombies hit within combo window
    public float comboWindow = 2f;      // Seconds within which hits count as a combo

    private float timeRemaining;
    private int score;
    private bool gameActive;
    private int comboCount;
    private float comboTimer;

    // Events that other systems subscribe to
    public event System.Action<int> OnScoreChanged;
    public event System.Action<float> OnTimeChanged;
    public event System.Action<int, Vector3> OnZombieHit;   // score delta, world position
    public event System.Action OnGameOver;
    public event System.Action OnGameStarted;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
    }

    void Start() => StartGame();

    void Update()
    {
        if (!gameActive) return;

        timeRemaining -= Time.deltaTime;
        OnTimeChanged?.Invoke(timeRemaining);

        if (comboCount > 0)
        {
            comboTimer -= Time.deltaTime;
            if (comboTimer <= 0f) comboCount = 0;
        }

        if (timeRemaining <= 0f) { timeRemaining = 0f; EndGame(); }
    }

    public void StartGame()
    {
        timeRemaining = gameDuration;
        score = 0;
        gameActive = true;
        comboCount = 0;
        OnGameStarted?.Invoke();
        OnScoreChanged?.Invoke(score);
        OnTimeChanged?.Invoke(timeRemaining);
    }

    /// <summary>
    /// Call this whenever the vehicle hits one or more zombies.
    /// hitPosition is the world-space point where the hit occurred (for popup spawning).
    /// </summary>
    public void RegisterHit(int zombiesHitCount, Vector3 hitPosition)
    {
        if (!gameActive) return;

        comboCount += zombiesHitCount;
        comboTimer = comboWindow;

        int delta = zombiesHitCount * pointsPerZombie;
        if (comboCount >= 3) delta += comboBonus;

        score += delta;
        OnScoreChanged?.Invoke(score);
        OnZombieHit?.Invoke(delta, hitPosition);
    }

    public int GetScore() => score;
    public float GetTimeRemaining() => timeRemaining;
    public bool IsGameActive() => gameActive;

    void EndGame()
    {
        gameActive = false;
        OnGameOver?.Invoke();
        string playerName = PlayerPrefs.GetString("PlayerName", "Unknown Driver");
        LeaderboardManager.Instance.SubmitScore(playerName, score);
    }

    public void RestartGame() => SceneManager.LoadScene(SceneManager.GetActiveScene().name);
}
