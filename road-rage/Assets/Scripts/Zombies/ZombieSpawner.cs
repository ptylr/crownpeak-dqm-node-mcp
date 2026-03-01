using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Continuously spawns zombie cyclists ahead of the player vehicle for the
/// duration of the game. Cyclists appear individually, in side-by-side pairs
/// (riding two abreast — as they do), or in larger peloton-style groups.
/// Roughly 40% travel toward the player (oncoming); the rest ride in the
/// same direction, obliviously hogging the road.
///
/// Spawn interval tightens slightly over time to ramp up intensity.
/// </summary>
public class ZombieSpawner : MonoBehaviour
{
    [Header("Prefabs")]
    [Tooltip("One or more ZombieOnBike prefabs — chosen at random each spawn.")]
    public GameObject[] zombiePrefabs;

    [Header("Spawn Distance & Road Layout")]
    [Tooltip("How far ahead of the player to spawn zombies (metres).")]
    public float spawnAheadDistance = 70f;
    [Tooltip("Number of traversable lanes on the road.")]
    public int laneCount = 3;
    [Tooltip("Width of each lane in metres.")]
    public float laneWidth = 3.5f;

    [Header("Timing")]
    public float spawnIntervalStart = 2.2f;    // seconds between spawns at t=0
    public float spawnIntervalEnd = 1.0f;      // seconds between spawns at t=60

    [Header("Direction")]
    [Range(0f, 1f)]
    public float againstTrafficChance = 0.4f;

    // Spawn-group weights: solo, pair, group
    readonly int[] groupSizes = { 1, 2, 4 };
    readonly float[] groupWeights = { 0.5f, 0.3f, 0.2f };

    Transform playerTransform;
    float spawnTimer;
    float elapsed;

    void Start()
    {
        playerTransform = FindObjectOfType<PlayerVehicle>()?.transform;
        spawnTimer = spawnIntervalStart;
        GameManager.Instance.OnGameOver += OnGameOver;
    }

    void OnDestroy()
    {
        if (GameManager.Instance) GameManager.Instance.OnGameOver -= OnGameOver;
    }

    void OnGameOver() => enabled = false;

    void Update()
    {
        if (!GameManager.Instance.IsGameActive() || playerTransform == null) return;

        elapsed += Time.deltaTime;
        spawnTimer -= Time.deltaTime;

        if (spawnTimer <= 0f)
        {
            SpawnGroup();

            // Linearly shrink interval over 60 s
            float t = Mathf.Clamp01(elapsed / GameManager.Instance.GetTimeRemaining());
            spawnTimer = Mathf.Lerp(spawnIntervalStart, spawnIntervalEnd, t);
        }
    }

    void SpawnGroup()
    {
        int size = PickGroupSize();
        ZombieController.TravelDirection dir = Random.value < againstTrafficChance
            ? ZombieController.TravelDirection.AgainstTraffic
            : ZombieController.TravelDirection.WithTraffic;

        List<int> lanes = PickLanes(size);
        float spawnZ = playerTransform.position.z + spawnAheadDistance;

        foreach (int lane in lanes)
        {
            float x = (lane - (laneCount - 1) / 2f) * laneWidth;
            // Small random jitter within the lane
            x += Random.Range(-laneWidth * 0.25f, laneWidth * 0.25f);

            Vector3 pos = new Vector3(playerTransform.position.x + x, 0f, spawnZ);
            pos.z += Random.Range(-2f, 2f); // stagger depth slightly

            GameObject prefab = zombiePrefabs[Random.Range(0, zombiePrefabs.Length)];
            GameObject go = Instantiate(prefab, pos, Quaternion.identity);
            go.GetComponent<ZombieController>().direction = dir;
        }
    }

    int PickGroupSize()
    {
        float total = 0f;
        foreach (float w in groupWeights) total += w;
        float roll = Random.Range(0f, total);
        float cumulative = 0f;
        for (int i = 0; i < groupWeights.Length; i++)
        {
            cumulative += groupWeights[i];
            if (roll <= cumulative) return groupSizes[i];
        }
        return groupSizes[0];
    }

    /// <summary>Picks <count> distinct lane indices, clamped to laneCount.</summary>
    List<int> PickLanes(int count)
    {
        count = Mathf.Min(count, laneCount);
        List<int> available = new List<int>();
        for (int i = 0; i < laneCount; i++) available.Add(i);

        List<int> chosen = new List<int>();
        while (chosen.Count < count && available.Count > 0)
        {
            int idx = Random.Range(0, available.Count);
            chosen.Add(available[idx]);
            available.RemoveAt(idx);
        }
        return chosen;
    }
}
