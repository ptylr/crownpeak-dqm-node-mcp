using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Procedurally tiles road segments and roadside props infinitely ahead of the
/// player. Old segments are recycled (object-pooled) as the vehicle passes them,
/// keeping memory usage constant regardless of game duration.
///
/// Scene setup:
///   - Assign a flat road segment prefab (e.g. a 20 m × 20 m plane with road
///     texture, kerbs, lane markings).
///   - Optionally assign roadside prop prefabs (hedges, walls, trees, signs).
///   - Place this component on any persistent GameObject (e.g. GameManager GO).
/// </summary>
public class RoadGenerator : MonoBehaviour
{
    [Header("Road Segment")]
    public GameObject roadSegmentPrefab;
    [Tooltip("Length of one road segment along the Z axis (metres).")]
    public float segmentLength = 20f;
    [Tooltip("How many segments to keep ahead of the player.")]
    public int segmentsAhead = 10;
    [Tooltip("How many segments to keep behind the player before recycling.")]
    public int segmentsBehind = 2;

    [Header("Roadside Props")]
    [Tooltip("Hedge / wall / tree prefabs placed on the road verges.")]
    public GameObject[] propPrefabs;
    [Tooltip("How far either side of centre to place props (metres).")]
    public float propLateralOffset = 9f;
    [Range(0f, 1f)]
    [Tooltip("Probability of spawning a prop on each side of each new segment.")]
    public float propSpawnChance = 0.7f;

    // Object pool — reuse segments instead of Instantiate/Destroy
    readonly Queue<GameObject> pool = new Queue<GameObject>();
    readonly LinkedList<(int index, GameObject go)> activeSegments
        = new LinkedList<(int, GameObject)>();

    Transform playerTransform;
    int nextSegmentIndex;

    void Start()
    {
        playerTransform = FindObjectOfType<PlayerVehicle>()?.transform;

        // Seed initial road so the player never sees an empty start
        int startIndex = -segmentsBehind;
        nextSegmentIndex = startIndex;
        for (int i = startIndex; i < segmentsAhead; i++) SpawnSegment(i);
        nextSegmentIndex = segmentsAhead;
    }

    void Update()
    {
        if (playerTransform == null) return;

        int playerSegment = Mathf.FloorToInt(playerTransform.position.z / segmentLength);

        // Extend road ahead
        while (nextSegmentIndex < playerSegment + segmentsAhead)
        {
            SpawnSegment(nextSegmentIndex);
            nextSegmentIndex++;
        }

        // Recycle segments that are now behind the player
        while (activeSegments.Count > 0)
        {
            var first = activeSegments.First.Value;
            if (first.index < playerSegment - segmentsBehind)
            {
                RecycleSegment(first.go);
                activeSegments.RemoveFirst();
            }
            else break;
        }
    }

    void SpawnSegment(int index)
    {
        GameObject seg = GetFromPool();
        seg.transform.position = new Vector3(0f, 0f, index * segmentLength);
        seg.transform.rotation = Quaternion.identity;
        seg.SetActive(true);
        activeSegments.AddLast((index, seg));

        SpawnPropsForSegment(index);
    }

    void SpawnPropsForSegment(int index)
    {
        if (propPrefabs == null || propPrefabs.Length == 0) return;

        float baseZ = index * segmentLength;

        // Left side
        if (Random.value < propSpawnChance)
            SpawnProp(new Vector3(-propLateralOffset, 0f, baseZ + Random.Range(0f, segmentLength)));

        // Right side
        if (Random.value < propSpawnChance)
            SpawnProp(new Vector3(propLateralOffset, 0f, baseZ + Random.Range(0f, segmentLength)));
    }

    void SpawnProp(Vector3 position)
    {
        GameObject prefab = propPrefabs[Random.Range(0, propPrefabs.Length)];
        // Props are simple — not pooled for now, destroyed with the road segment
        GameObject prop = Instantiate(prefab, position,
            Quaternion.Euler(0f, Random.Range(0f, 360f), 0f), transform);
        // Destroy the prop when it would scroll too far behind (loosely timed)
        Destroy(prop, (segmentsBehind + segmentsAhead + 2) * segmentLength / FindObjectOfType<PlayerVehicle>().forwardSpeed);
    }

    // --- Pool helpers ---

    GameObject GetFromPool()
    {
        if (pool.Count > 0) return pool.Dequeue();
        return Instantiate(roadSegmentPrefab, transform);
    }

    void RecycleSegment(GameObject seg)
    {
        seg.SetActive(false);
        pool.Enqueue(seg);
    }
}
